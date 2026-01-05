import { NextRequest, NextResponse } from "next/server";
import { retrieveHadithByIds, retrieveHadithForQuestion } from "@/server/rag/retriever";
import { generateRagAnswer } from "@/server/rag/generator";
import { buildRagContext } from "@/server/rag/context";
import { inferRagIntent } from "@/server/rag/intent";
import { loadGraphContext } from "@/server/rag/graph-context";
import { retrieveHadithForQuestionKg } from "@/server/rag/kg-retriever";
import { findHadithIdBySourceAndNumber, findSourcesByName } from "@/server/rag/hadith-lookup";
import {
  findExactNarratorByName,
  findNarratorsByName,
  getNarratorDetailsById,
  getNarratorDetailsByName,
} from "@/server/rag/narrator";
import { extractStructuredFilters, searchHadithIdsByQuery } from "@/server/rag/search";
import { fetchAnswerGraph, fetchNarratorNetwork, fetchVariants } from "@/server/graph/queries";
import { getHadithById, getHadithByIds } from "@/features/hadith/server/hadith-service";
import { HadithInsight } from "@/features/hadith/types";
import { RagCitation, RagFilters } from "@/types/rag";
import { getClient } from "@/server/db/client";

const SAFE_FALLBACK =
  "I couldn’t find enough relevant hadith in the provided context to answer that safely.";
const REQUIRE_ID_MESSAGE =
  "Please provide a hadith id (e.g., \"Hadith ID 123\") so I can look that up.";
const REQUIRE_NARRATOR_MESSAGE =
  "Please provide a narrator name or id (e.g., \"Narrator ID 45\" or \"connected to Abu Huraira\").";
const MAX_CONTEXT_DETAILS = 3;
const MAX_STRUCTURED_RESULTS = 12;
const MAX_GRAPH_CONTEXT = 2;
const SOURCE_HINTS = [
  "bukhari",
  "muslim",
  "tirmidhi",
  "nasai",
  "nasa'i",
  "abu dawud",
  "ibn majah",
  "muwatta",
  "malik",
  "ahmad",
  "bayhaqi",
  "tabarani",
  "darimi",
  "hakim",
  "mu'jam",
];

function buildCitation(hadith: HadithInsight): RagCitation {
  return {
    hadithId: Number(hadith.id),
    displayNumber: hadith.details.displayNumber ?? null,
    source: hadith.details.source,
  };
}

function formatChainAnswer(hadith: HadithInsight): string {
  if (!hadith.chain.length) {
    return `I don’t have chain data stored for ${hadith.details.source} ${hadith.details.displayNumber ?? hadith.id}.`;
  }
  const chainNames = hadith.chain.map((node) => node.name).join(" -> ");
  const label = hadith.details.displayLabel ?? `Hadith ${hadith.details.displayNumber ?? hadith.id}`;
  return `Narrator chain for ${label}: ${chainNames}.`;
}

function formatVariantsAnswer(
  hadith: HadithInsight,
  variants: Array<{ hadithId: number; displayNumber: string; source: string; similarityReason: string }>,
): string {
  if (!variants.length) {
    return `No variants were found in the graph for ${hadith.details.source} ${hadith.details.displayNumber ?? hadith.id}.`;
  }
  const items = variants.slice(0, 10).map((variant) => {
    return `${variant.source} ${variant.displayNumber} (${variant.similarityReason})`;
  });
  return `Variants for ${hadith.details.source} ${hadith.details.displayNumber ?? hadith.id}: ${items.join("; ")}.`;
}

function formatNarratorNetworkAnswer(
  narratorName: string,
  depth: number,
  nodes: Array<{ id: string; label: string; type: string }>,
): string {
  const narrators = nodes
    .filter((node) => node.type === "Narrator")
    .map((node) => node.label)
    .filter((label) => label && label !== narratorName);
  if (!narrators.length) {
    return `No connected narrators were found for ${narratorName} within ${depth} hops.`;
  }
  const list = narrators.slice(0, 25).join(", ");
  const suffix = narrators.length > 25 ? " (truncated)" : "";
  return `Narrators connected to ${narratorName} within ${depth} hops: ${list}${suffix}.`;
}

async function buildAnswerGraph(citations?: RagCitation[]) {
  if (!citations?.length) return null;
  const ids = citations.map((citation) => citation.hadithId).filter((id) => Number.isFinite(id));
  if (!ids.length) return null;
  try {
    return await fetchAnswerGraph(ids);
  } catch (error) {
    console.warn("[rag] Unable to load answer graph", error);
    return null;
  }
}

function formatNarratorDetails(
  detail: Awaited<ReturnType<typeof getNarratorDetailsById>>,
): string | null {
  if (!detail) return null;
  const parts: string[] = [];
  if (detail.descriptor) parts.push(detail.descriptor);
  if (detail.lifespan) parts.push(`Lifespan: ${detail.lifespan}`);
  if (detail.tiers?.length) parts.push(`Tier: ${detail.tiers.join(", ")}`);
  if (detail.reliabilities?.length) parts.push(`Reliability: ${detail.reliabilities.join(", ")}`);
  if (detail.methods?.length) parts.push(`Transmission: ${detail.methods.join(", ")}`);
  if (!parts.length) {
    return `I only have the name for ${detail.name} in the narrator table.`;
  }
  return `${detail.name} — ${parts.join(" · ")}.`;
}

function extractNarratorDetailName(question: string): string | null {
  const patterns = [
    /tell me more about\s+([^?.!]+)$/i,
    /tell me about\s+([^?.!]+)$/i,
    /who is\s+([^?.!]+)$/i,
    /information on\s+([^?.!]+)$/i,
    /details on\s+([^?.!]+)$/i,
  ];
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (!match?.[1]) continue;
    const name = match[1].trim();
    if (!name) continue;
    if (name.toLowerCase().includes("hadith")) continue;
    return name;
  }
  return null;
}

function formatHadithOptions(matches: HadithInsight[], label: string) {
  const items = matches.slice(0, 6).map((match) => {
    return `${match.details.source} ${match.details.displayNumber ?? match.id} (ID ${match.id})`;
  });
  return `I found multiple hadiths matching ${label}: ${items.join("; ")}. Please specify the hadith id.`;
}

function parseSourceNumber(question: string): { sourceQuery: string; number: number } | null {
  const lower = question.toLowerCase();
  for (const hint of SOURCE_HINTS) {
    const index = lower.indexOf(hint);
    if (index === -1) continue;
    const tail = lower.slice(index + hint.length);
    const match = tail.match(/\s*[:#-]?\s*(?:hadith\s*)?(?:no\.?|#)?\s*(\d+)\b/i);
    if (!match?.[1]) continue;
    const number = Number(match[1]);
    if (!Number.isFinite(number) || number <= 0) continue;
    return { sourceQuery: hint, number };
  }
  return null;
}

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
    const { filters: structuredFilters, hasExplicitFilters } = extractStructuredFilters(question);
    const intent = inferRagIntent(question);

    if (intent.type === "chain") {
      let hadithId = intent.hadithId;
      if (!hadithId) {
        const candidates = await searchHadithIdsByQuery({
          text: question,
          filters: structuredFilters,
          limit: 5,
        });
        if (candidates.length === 1) {
          hadithId = candidates[0];
        } else if (candidates.length > 1) {
          const options = await getHadithByIds(candidates);
          const response = formatHadithOptions(options, "that description");
          await logRagInteraction({
            question,
            filters,
            retrievedIds: candidates,
            response,
            citations: [],
          });
          return NextResponse.json({ answer: response, citations: [] });
        }
      }
      if (!hadithId) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_ID_MESSAGE,
          citations: [],
        });
        return NextResponse.json({ answer: REQUIRE_ID_MESSAGE, citations: [] });
      }
      const hadith = await getHadithById(String(hadithId));
      if (!hadith) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [hadithId],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const response = formatChainAnswer(hadith);
      const citations = [buildCitation(hadith)];
      await logRagInteraction({
        question,
        filters,
        retrievedIds: [hadithId],
        response,
        citations,
      });
      return NextResponse.json({ answer: response, citations });
    }

    if (intent.type === "variants") {
      let hadithId = intent.hadithId;
      if (!hadithId) {
        const candidates = await searchHadithIdsByQuery({
          text: question,
          filters: structuredFilters,
          limit: 5,
        });
        if (candidates.length === 1) {
          hadithId = candidates[0];
        } else if (candidates.length > 1) {
          const options = await getHadithByIds(candidates);
          const response = formatHadithOptions(options, "that description");
          await logRagInteraction({
            question,
            filters,
            retrievedIds: candidates,
            response,
            citations: [],
          });
          return NextResponse.json({ answer: response, citations: [] });
        }
      }
      if (!hadithId) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_ID_MESSAGE,
          citations: [],
        });
        return NextResponse.json({ answer: REQUIRE_ID_MESSAGE, citations: [] });
      }
      const hadith = await getHadithById(String(hadithId));
      if (!hadith) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [hadithId],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const variantsResult = await fetchVariants(hadithId);
      if (!variantsResult.variants.length && !variantsResult.hasMatch) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [hadithId],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const response = formatVariantsAnswer(hadith, variantsResult.variants);
      const citations = [buildCitation(hadith)];
      await logRagInteraction({
        question,
        filters,
        retrievedIds: [hadithId],
        response,
        citations,
      });
      return NextResponse.json({ answer: response, citations });
    }

    if (intent.type === "narrator-network") {
      const depth = intent.depth ?? 2;
      let narratorId = intent.narratorId;
      let narratorName = intent.narratorName;

      if (!narratorId && narratorName) {
        const exact = await findExactNarratorByName(narratorName);
        if (exact) {
          narratorId = exact.id;
          narratorName = exact.name;
        } else {
          const matches = await findNarratorsByName(narratorName);
          if (matches.length > 1) {
            const options = matches.map((match) => `${match.name} (ID ${match.id})`).join(", ");
            const response = `I found multiple narrators matching "${narratorName}": ${options}. Please specify the narrator id.`;
            await logRagInteraction({
              question,
              filters,
              retrievedIds: matches.map((match) => match.id),
              response,
              citations: [],
            });
            return NextResponse.json({ answer: response, citations: [] });
          }
          if (matches.length === 1) {
            narratorId = matches[0].id;
            narratorName = matches[0].name;
          }
        }
      }

      if (narratorId && !narratorName) {
        narratorName = `Narrator ${narratorId}`;
      }

      if (!narratorId || !narratorName) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_NARRATOR_MESSAGE,
          citations: [],
        });
        return NextResponse.json({ answer: REQUIRE_NARRATOR_MESSAGE, citations: [] });
      }

      const graph = await fetchNarratorNetwork(narratorId, depth);
      if (!graph) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [narratorId],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const response = formatNarratorNetworkAnswer(narratorName, depth, graph.nodes);
      await logRagInteraction({
        question,
        filters,
        retrievedIds: [narratorId],
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
    }

    if (intent.type === "hadith") {
      const results = await retrieveHadithByIds([intent.hadithId]);
      if (!results.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const hadithDetails = await getHadithByIds([intent.hadithId]);
      const hadithMap = new Map(hadithDetails.map((item) => [Number(item.id), item]));
      const graphMap = await loadGraphContext([intent.hadithId], 1);
      const context = buildRagContext(results, hadithMap, graphMap);
      const answer = await generateRagAnswer({ question, results, context });
      const graph = await buildAnswerGraph(answer.citations);
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
        graph,
        retrieved: results,
      });
    }

    const narratorDetailName = extractNarratorDetailName(question);
    if (narratorDetailName) {
      let detail = await getNarratorDetailsByName(narratorDetailName);
      if (!detail) {
        const matches = await findNarratorsByName(narratorDetailName);
        if (matches.length > 1) {
          const options = matches.map((match) => `${match.name} (ID ${match.id})`).join(", ");
          const response = `I found multiple narrators matching "${narratorDetailName}": ${options}. Please specify the narrator id.`;
          await logRagInteraction({
            question,
            filters,
            retrievedIds: matches.map((match) => match.id),
            response,
            citations: [],
          });
          return NextResponse.json({ answer: response, citations: [] });
        }
        if (matches.length === 1) {
          detail = await getNarratorDetailsById(matches[0].id);
        }
      }
      if (detail) {
        const response = formatNarratorDetails(detail);
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [detail.id],
          response: response ?? SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: response ?? SAFE_FALLBACK, citations: [] });
      }
    }

    const sourceNumber = parseSourceNumber(question);
    if (sourceNumber) {
      const sources = await findSourcesByName(sourceNumber.sourceQuery);
      if (sources.length > 1) {
        const options = sources.map((source) => `${source.name} (ID ${source.id})`).join(", ");
        const response = `I found multiple sources matching "${sourceNumber.sourceQuery}": ${options}. Please specify the source id.`;
        await logRagInteraction({
          question,
          filters,
          retrievedIds: sources.map((source) => source.id),
          response,
          citations: [],
        });
        return NextResponse.json({ answer: response, citations: [] });
      }
      if (sources.length === 1) {
        const hadithId = await findHadithIdBySourceAndNumber(sources[0].id, sourceNumber.number);
        if (hadithId) {
          const results = await retrieveHadithByIds([hadithId]);
          const hadithDetails = await getHadithByIds([hadithId]);
          const hadithMap = new Map(hadithDetails.map((item) => [Number(item.id), item]));
          const graphMap = await loadGraphContext([hadithId], 1);
          const context = buildRagContext(results, hadithMap, graphMap);
          const answer = await generateRagAnswer({ question, results, context });
          const graph = await buildAnswerGraph(answer.citations);
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
            graph,
            retrieved: results,
          });
        }
      }
    }

    if (hasExplicitFilters) {
      const structuredIds = await searchHadithIdsByQuery({
        text: question,
        filters: structuredFilters,
        limit: MAX_STRUCTURED_RESULTS,
      });
      if (structuredIds.length) {
        const results = await retrieveHadithByIds(structuredIds);
        const hadithDetails = await getHadithByIds(structuredIds);
        const hadithMap = new Map(hadithDetails.map((item) => [Number(item.id), item]));
        const graphMap = await loadGraphContext(structuredIds, MAX_GRAPH_CONTEXT);
        const context = buildRagContext(results, hadithMap, graphMap);
        const answer = await generateRagAnswer({ question, results, context });
        const graph = await buildAnswerGraph(answer.citations);
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
          graph,
          retrieved: results,
        });
      }
    }

    const kgResults = await retrieveHadithForQuestionKg({
      question,
      limit,
      model: process.env.EMBEDDING_MODEL,
      filters,
    });
    const results =
      kgResults.length > 0 ? kgResults : await retrieveHadithForQuestion({ question, ...filters, limit });

    if (!results.length) {
      const structuredIds = await searchHadithIdsByQuery({
        text: question,
        filters: structuredFilters,
        limit: MAX_STRUCTURED_RESULTS,
      });
      if (structuredIds.length) {
        const structuredResults = await retrieveHadithByIds(structuredIds);
        const structuredDetails = await getHadithByIds(structuredIds);
        const structuredMap = new Map(structuredDetails.map((item) => [Number(item.id), item]));
        const graphMap = await loadGraphContext(structuredIds, MAX_GRAPH_CONTEXT);
        const context = buildRagContext(structuredResults, structuredMap, graphMap);
        const answer = await generateRagAnswer({ question, results: structuredResults, context });
        const graph = await buildAnswerGraph(answer.citations);
        await logRagInteraction({
          question,
          filters,
          retrievedIds: structuredResults.map((r) => r.hadithId),
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
          graph,
          retrieved: structuredResults,
        });
      }

      // If nothing retrieved, return fallback without calling LLM.
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

    const detailIds = results.slice(0, MAX_CONTEXT_DETAILS).map((result) => result.hadithId);
    const hadithDetails = await getHadithByIds(detailIds);
    const hadithMap = new Map(hadithDetails.map((item) => [Number(item.id), item]));
    const graphMap = await loadGraphContext(detailIds, MAX_GRAPH_CONTEXT);
    const context = buildRagContext(results, hadithMap, graphMap);
    const answer = await generateRagAnswer({ question, results, context });
    const graph = await buildAnswerGraph(answer.citations);

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
      graph,
      retrieved: results, // include for now; can be trimmed in production
    });
  } catch (error) {
    console.error("[api/rag/query] Failed", error);
    return NextResponse.json({ error: "Unable to process request" }, { status: 500 });
  }
}
