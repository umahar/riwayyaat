// Mark server-only in Next.js; ignore when running standalone scripts (tsx/node).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop for script contexts */
}
import OpenAI from "openai";

export type RagRouteDecision = {
  intent: "list" | "hadith" | "chain" | "variants" | "narrator-network" | "narrator-aggregate" | "semantic";
  count?: number;
  source?: string;
  hadithId?: number;
  narratorId?: number;
  narratorName?: string;
  useContext?: boolean;
  confidence?: number;
};

const DEFAULT_ROUTER_MODEL = process.env.RAG_ROUTER_MODEL || process.env.RAG_LLM_MODEL || "gpt-4.1-mini";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for routing");
  return new OpenAI({ apiKey });
}

function buildSystemPrompt() {
  return `
You are a routing classifier for a hadith assistant. Return ONLY JSON with:
{
  "intent": "list" | "hadith" | "chain" | "variants" | "narrator-network" | "narrator-aggregate" | "semantic",
  "count": number | null,
  "source": string | null,
  "hadithId": number | null,
  "narratorId": number | null,
  "narratorName": string | null,
  "useContext": boolean | null,
  "confidence": number
}

Rules:
- intent "list": user asks for N hadiths, or a list of hadiths from a source/book.
- intent "hadith": user asks about a specific hadith and provides a number/id/source+number.
- intent "chain"/"variants"/"narrator-network": user asks for isnad/variants/narrator network.
- intent "narrator-aggregate": user asks for most frequent/top/common narrators within a collection/book/chapter.
- intent "semantic": general explanation or topical question.
- count should be 1-20 when applicable.
- source should be the collection name if mentioned (e.g., "Sahih al-Bukhari").
- useContext true only if the question is a follow-up that refers to a previous hadith ("this hadith", "tell me more", etc.) and no new topic is introduced.
- confidence between 0 and 1.
`;
}

function normalizeDecision(raw: RagRouteDecision): RagRouteDecision | null {
  if (!raw || typeof raw.intent !== "string") return null;
  const allowed = new Set([
    "list",
    "hadith",
    "chain",
    "variants",
    "narrator-network",
    "narrator-aggregate",
    "semantic",
  ]);
  if (!allowed.has(raw.intent)) return null;
  const count =
    typeof raw.count === "number" && Number.isFinite(raw.count)
      ? Math.min(20, Math.max(1, Math.trunc(raw.count)))
      : undefined;
  const hadithId =
    typeof raw.hadithId === "number" && Number.isFinite(raw.hadithId) ? Math.trunc(raw.hadithId) : undefined;
  const narratorId =
    typeof raw.narratorId === "number" && Number.isFinite(raw.narratorId) ? Math.trunc(raw.narratorId) : undefined;
  const narratorName = typeof raw.narratorName === "string" ? raw.narratorName.trim() : undefined;
  const source = typeof raw.source === "string" ? raw.source.trim() : undefined;
  const useContext = typeof raw.useContext === "boolean" ? raw.useContext : undefined;
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : undefined;
  return {
    intent: raw.intent,
    count,
    source,
    hadithId,
    narratorId,
    narratorName,
    useContext,
    confidence,
  };
}

export async function routeRagIntent(params: {
  question: string;
  contextHadithId?: number;
}): Promise<RagRouteDecision | null> {
  if (!params.question.trim()) return null;
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: DEFAULT_ROUTER_MODEL,
    temperature: 0.2,
    max_tokens: 220,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: JSON.stringify({
          question: params.question,
          contextHadithId: params.contextHadithId ?? null,
        }),
      },
    ],
  });
  const content = completion.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) return null;
  try {
    const parsed = JSON.parse(content) as RagRouteDecision;
    return normalizeDecision(parsed);
  } catch {
    return null;
  }
}
