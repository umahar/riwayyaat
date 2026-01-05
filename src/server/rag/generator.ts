// Mark server-only in Next.js; ignore when running standalone scripts (tsx/node).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop for script contexts */
}
import OpenAI from "openai";
import { RagResult, RagAnswer, RagCitation, RagContextEntry } from "@/types/rag";
import { DEFAULT_EMBEDDING_MODEL } from "@/server/rag/embeddings";

type GenerateParams = {
  question: string;
  results: RagResult[];
  context?: RagContextEntry[];
  model?: string; // LLM model, defaults to GPT-4.1-class
  maxTokens?: number;
  temperature?: number;
};

const DEFAULT_LLM_MODEL = process.env.RAG_LLM_MODEL || "gpt-4.1-mini";
const SAFETY_FALLBACK =
  "I don’t have enough trustworthy information from the provided narrations to answer that based on the supplied context.";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for RAG generation");
  return new OpenAI({ apiKey });
}

function formatContext(results: RagResult[], override?: RagContextEntry[]) {
  if (override && override.length) return override;
  // Provide lean, citation-ready context. Avoid speculation; stick to matn, source, and basic metadata.
  return results.map((r) => ({
    hadithId: r.hadithId,
    displayNumber: r.displayNumber ?? String(r.hadithId),
    source: r.source.name,
    book: r.book?.name ?? null,
    chapter: r.chapter?.name ?? null,
    matn: r.matn,
    tags: r.tags,
    grades: r.grades.map((g) => ({
      gradeTitle: g.grade.title,
      scholar: g.scholar.name,
      isPrimary: g.isPrimary,
    })),
  }));
}

function buildSystemPrompt() {
  return `
You are a hadith reference assistant. Follow these strict rules:
- Use ONLY the provided hadith context. Do not invent text, chains, or commentary.
- If the context is insufficient or unrelated, say you don’t have enough information.
- Do NOT offer fiqh rulings, personal opinions, or sectarian/legal judgments.
- Do NOT fabricate narrations, grades, chains, or scholar statements.
- Be concise, respectful, and neutral.
- Every statement that references a narration must include a citation with source and display number.
- If graph context is provided, you may summarize it, but only when it is tied to a cited hadith.
- If you are unsure, respond with a cautious fallback and no speculation.

Output format (JSON-safe):
{
  "answerText": "<your concise answer>",
  "citations": [
    { "hadithId": <number>, "displayNumber": "<string>", "source": "<string>" }
  ]
}
`;
}

function buildUserPrompt(question: string, context: unknown) {
  return [
    { role: "user" as const, content: `Question: ${question}` },
    {
      role: "user" as const,
      content: `Context (use ONLY this): ${JSON.stringify(context)}`,
    },
    {
      role: "user" as const,
      content:
        "Respond in the JSON format described in the system prompt. Do not add extra fields.",
    },
  ];
}

function safeFallback(): RagAnswer {
  return { answer: SAFETY_FALLBACK, citations: [] };
}

function parseAndValidateAnswer(raw: string, allowedIds: Set<number>): RagAnswer {
  try {
    const parsed = JSON.parse(raw) as { answerText?: string; citations?: RagCitation[] };
    if (!parsed || typeof parsed.answerText !== "string") return safeFallback();
    const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
    const validated = citations.filter(
      (c) =>
        c &&
        typeof c.hadithId === "number" &&
        allowedIds.has(c.hadithId) &&
        typeof c.source === "string" &&
        typeof c.displayNumber === "string",
    );
    if (validated.length === 0) {
      // Guardrail: require at least one valid citation from retrieved set.
      return safeFallback();
    }
    return { answer: parsed.answerText, citations: validated };
  } catch {
    return safeFallback();
  }
}

export async function generateRagAnswer(params: GenerateParams): Promise<RagAnswer> {
  const { question, results } = params;
  if (!question.trim() || results.length === 0) return safeFallback();

  const model = params.model || process.env.RAG_LLM_MODEL || DEFAULT_LLM_MODEL;
  const maxTokens = params.maxTokens ?? 400;
  const temperature = params.temperature ?? 0.2;

  const context = formatContext(results, params.context);
  const allowedIds = new Set(results.map((r) => r.hadithId));

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      ...buildUserPrompt(question, context),
    ],
  });

  const content = completion.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) return safeFallback();

  const parsed = parseAndValidateAnswer(content, allowedIds);
  if (
    process.env.RAG_DEBUG_RAW === "true" &&
    parsed.citations.length === 0 &&
    parsed.answer === SAFETY_FALLBACK
  ) {
    console.warn("[rag] Raw model output failed validation:", content);
  }
  return {
    ...parsed,
    modelUsed: model,
    usage: {
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    },
  };
}

/**
 * How it will be used later (example in /api/rag/query):
 *
 * const results = await retrieveHadithForQuestion({...});
 * const answer = await generateRagAnswer({ question, results, model: "gpt-4.1-mini" });
 * return answer; // { answer, citations: [...] }
 */
