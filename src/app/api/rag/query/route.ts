import { NextRequest, NextResponse } from "next/server";
import { retrieveHadithForQuestion } from "@/server/rag/retriever";
import { generateRagAnswer } from "@/server/rag/generator";
import { RagFilters } from "@/types/rag";
import { getClient } from "@/server/db/client";

const SAFE_FALLBACK =
  "I couldn’t find enough relevant hadith in the provided context to answer that safely.";

function parseBody(body: unknown): {
  question: string;
  filters: RagFilters;
  limit: number;
} | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const question = typeof data.question === "string" ? data.question.trim() : "";
  if (!question) return null;

  const filtersRaw = (data.filters ?? {}) as Record<string, unknown>;
  const asNumber = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };
  const asNumberArray = (value: unknown) =>
    Array.isArray(value) ? value.map((v) => Number(v)).filter((n) => Number.isFinite(n)) : [];

  const filters: RagFilters = {
    sourceId: asNumber(filtersRaw.sourceId),
    bookId: asNumber(filtersRaw.bookId),
    chapterId: asNumber(filtersRaw.chapterId),
    tagIds: asNumberArray(filtersRaw.tagIds),
    gradeIds: asNumberArray(filtersRaw.gradeIds),
    scholarIds: asNumberArray(filtersRaw.scholarIds),
  };

  const limit = (() => {
    const n = Number(data.limit);
    if (!Number.isFinite(n) || n <= 0) return 5;
    return Math.min(Math.max(1, Math.trunc(n)), 20);
  })();

  return { question, filters, limit };
}

async function logRagInteraction(params: {
  question: string;
  filters: RagFilters;
  retrievedIds: number[];
  modelUsed?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  response: string;
  citations: unknown;
}) {
  const client = await getClient();
  try {
    await client.query(
      `
        INSERT INTO rag_logs
          (question, filters, retrieved_ids, model, prompt_tokens, completion_tokens, total_tokens, response, citations)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        params.question,
        JSON.stringify(params.filters ?? {}),
        params.retrievedIds,
        params.modelUsed ?? null,
        params.promptTokens ?? null,
        params.completionTokens ?? null,
        params.totalTokens ?? null,
        params.response,
        JSON.stringify(params.citations ?? []),
      ],
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = parseBody(json);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { question, filters, limit } = parsed;
    const results = await retrieveHadithForQuestion({ question, ...filters, limit });

    // If nothing retrieved, return fallback without calling LLM.
    if (!results.length) {
      await logRagInteraction({
        question,
        filters,
        retrievedIds: [],
        response: SAFE_FALLBACK,
        citations: [],
      });
      return NextResponse.json({
        answer: SAFE_FALLBACK,
        citations: [],
        retrieved: [],
      });
    }

    const answer = await generateRagAnswer({ question, results });

    await logRagInteraction({
      question,
      filters,
      retrievedIds: results.map((r) => r.hadithId),
      modelUsed: answer.modelUsed,
      promptTokens: answer.usage?.promptTokens,
      completionTokens: answer.usage?.completionTokens,
      totalTokens: answer.usage?.totalTokens,
      response: answer.answer,
      citations: answer.citations,
    });

    return NextResponse.json({
      answer: answer.answer,
      citations: answer.citations,
      retrieved: results, // include for now; can be trimmed in production
    });
  } catch (error) {
    console.error("[api/rag/query] Failed", error);
    return NextResponse.json({ error: "Unable to process request" }, { status: 500 });
  }
}
