import { NextRequest, NextResponse } from "next/server";
import { retrieveHadithByIds, retrieveHadithForQuestion } from "@/server/rag/retriever";
import { generateRagAnswer } from "@/server/rag/generator";
import { buildRagContext } from "@/server/rag/context";
import { inferRagIntent } from "@/server/rag/intent";
import { routeRagIntent } from "@/server/rag/router";
import {
  parseSourceNumberFromQuestion,
  parseSourceNumbersFromQuestion,
  resolveSourceNumberMatch,
  resolveSourceNumberQuestion,
} from "@/server/rag/source-number";
import { loadGraphContext } from "@/server/rag/graph-context";
import { retrieveHadithForQuestionHybrid } from "@/server/rag/kg-retriever";
import { findHadithIdBySourceAndNumber, findSourcesByName } from "@/server/rag/hadith-lookup";
import {
  findExactNarratorByName,
  findNarratorsByName,
  findNarratorsByAlias,
  getNarratorDetailsById,
  getNarratorDetailsByName,
} from "@/server/rag/narrator";
import { extractStructuredFilters, searchHadithIdsByQuery } from "@/server/rag/search";
import { fetchAnswerGraph, fetchNarratorNetwork, fetchVariants } from "@/server/graph/queries";
import { getHadithById, getHadithByIds } from "@/features/hadith/server/hadith-service";
import { HadithInsight } from "@/features/hadith/types";
import { RagCitation, RagFilters, RagGraph, RagResult } from "@/types/rag";
import { getClient } from "@/server/db/client";
import { fetchHadithCoverage, summarizeCoverageForQuery } from "@/server/eval/kg";

const SAFE_FALLBACK =
  "I couldn’t find enough relevant hadith in the provided context to answer that safely.";
const SOURCE_NOT_FOUND =
  "I couldn’t find that collection/source in the database. Please check the name and try again.";
const REQUIRE_ID_MESSAGE =
  "Please provide a hadith id (e.g., \"Hadith ID 123\") so I can look that up.";
const REQUIRE_NARRATOR_MESSAGE =
  "Please provide a narrator name or id (e.g., \"Narrator ID 45\" or \"connected to Abu Huraira\").";
const HADITH_NOT_FOUND_MESSAGE =
  "I couldn’t find that hadith number for the specified source. Please double-check the number.";
const MAX_CONTEXT_DETAILS = 3;
const MAX_STRUCTURED_RESULTS = 12;
const MAX_GRAPH_CONTEXT = 2;
const TOPIC_KEYWORDS: Array<{ key: string; terms: string[] }> = [
  {
    key: "ablution",
    terms: ["ablution", "wudu", "wudhu", "wuḍū", "wudū", "wudu'", "khuff", "khuffain"],
  },
];
const LIST_VERBS = ["list", "show", "give", "provide", "share", "display"];
const LIST_NOUNS = ["hadith", "hadiths", "narration", "narrations", "reports"];
const NARRATOR_NETWORK_KEYWORDS = [
  "connected",
  "connection",
  "network",
  "hops",
  "hop",
  "ego network",
  "graph",
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

function formatNarratorChainDetails(hadith: HadithInsight): string {
  if (!hadith.chain.length) {
    return `I don’t have chain data stored for ${hadith.details.source} ${hadith.details.displayNumber ?? hadith.id}.`;
  }
  const label = hadith.details.displayLabel ?? `Hadith ${hadith.details.displayNumber ?? hadith.id}`;
  const items = hadith.chain.map((node) => {
    const bits = [node.name];
    if (node.type === "prophet") bits.push("Prophet");
    if (node.classificationDetail?.title) bits.push(node.classificationDetail.title);
    if (node.reliabilityDetail?.title) bits.push(node.reliabilityDetail.title);
    if (node.lifespan) bits.push(node.lifespan);
    return bits.join(" — ");
  });
  return `Narrators for ${label}: ${items.join("; ")}.`;
}

function formatListAnswer(hadiths: HadithInsight[], sourceLabel?: string | null): string {
  if (!hadiths.length) return SAFE_FALLBACK;
  const prefix = sourceLabel ? `from ${sourceLabel}` : "from your collection";
  const items = hadiths.map((hadith, index) => {
    const label = `${hadith.details.source} ${hadith.details.displayNumber ?? hadith.id}`;
    const snippet = hadith.matn.split("\n").map((line) => line.trim()).find(Boolean) ?? hadith.matn;
    const text = snippet.length > 180 ? `${snippet.slice(0, 180)}…` : snippet;
    return `${index + 1}. ${text} (${label})`;
  });
  return `Here ${hadiths.length === 1 ? "is" : "are"} ${hadiths.length} hadiths ${prefix}: ${items.join(" ")}`;
}

async function fetchListHadithIds(sourceId: number | null, limit: number): Promise<number[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<{ id: number }>(
      `
        SELECT id
        FROM hadith
        WHERE deleted_at IS NULL
          AND ($1::int IS NULL OR source_id = $1)
        ORDER BY id
        LIMIT $2
      `,
      [sourceId, Math.min(Math.max(1, limit), 20)],
    );
    return rows.map((row) => row.id);
  } finally {
    client.release();
  }
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

function mergeGraphs(primary: RagGraph | null, provenance?: RagGraph | null): RagGraph | null {
  if (!primary && !provenance) return null;
  const nodes = new Map<string, RagGraph["nodes"][number]>();
  const edges = new Map<string, RagGraph["edges"][number]>();

  const addNode = (node: RagGraph["nodes"][number]) => {
    const existing = nodes.get(node.id);
    nodes.set(node.id, {
      ...existing,
      ...node,
      provenance: existing?.provenance || node.provenance || false,
    });
  };
  const addEdge = (edge: RagGraph["edges"][number]) => {
    const existing = edges.get(edge.id);
    edges.set(edge.id, {
      ...existing,
      ...edge,
      provenance: existing?.provenance || edge.provenance || false,
    });
  };

  primary?.nodes.forEach(addNode);
  primary?.edges.forEach(addEdge);
  provenance?.nodes.forEach((node) => addNode({ ...node, provenance: true }));
  provenance?.edges.forEach((edge) => addEdge({ ...edge, provenance: true }));

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
}

function buildRetrievalScores(results: RagResult[]) {
  return results.map((result) => ({
    hadithId: result.hadithId,
    similarity: result.similarity ?? null,
    ...(result.retrieval ?? {}),
  }));
}

async function mergeContextResults(results: RagResult[], contextIds: number[]): Promise<RagResult[]> {
  if (!contextIds.length) return results;
  const existing = new Set(results.map((result) => result.hadithId));
  const missing = contextIds.filter((id) => Number.isFinite(id) && id > 0 && !existing.has(id));
  if (!missing.length) return results;
  const contextResults = await retrieveHadithByIds(missing);
  return [...contextResults, ...results];
}

function buildContextDetailIds(results: RagResult[], contextIds: number[], maxDefault: number): number[] {
  const limit = contextIds.length ? Math.min(10, Math.max(maxDefault, contextIds.length)) : maxDefault;
  const detailIds: number[] = [];
  const seen = new Set<number>();
  for (const id of contextIds) {
    if (detailIds.length >= limit) break;
    if (!seen.has(id)) {
      detailIds.push(id);
      seen.add(id);
    }
  }
  for (const result of results) {
    if (detailIds.length >= limit) break;
    if (!seen.has(result.hadithId)) {
      detailIds.push(result.hadithId);
      seen.add(result.hadithId);
    }
  }
  return detailIds;
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
    /tell me more about\s+([^?.!]+?)(?:[?.!]|$)/i,
    /tell me about\s+([^?.!]+?)(?:[?.!]|$)/i,
    /who is\s+([^?.!]+?)(?:[?.!]|$)/i,
    /information on\s+([^?.!]+?)(?:[?.!]|$)/i,
    /details on\s+([^?.!]+?)(?:[?.!]|$)/i,
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

function extractTopicTerms(question: string): string[] {
  const lower = question.toLowerCase();
  const matches = TOPIC_KEYWORDS.filter((topic) => topic.terms.some((term) => lower.includes(term)));
  const unique = new Set<string>();
  matches.forEach((topic) => topic.terms.forEach((term) => unique.add(term)));
  return Array.from(unique);
}

function clampCount(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.min(20, Math.max(1, Math.trunc(value)));
}

function detectListIntent(question: string): { wantsList: boolean; count?: number } {
  const lower = question.toLowerCase();
  const countMatch = lower.match(/\b(\d+)\s+(?:hadith|hadiths|narrations|reports)\b/i);
  const count = countMatch ? Number(countMatch[1]) : undefined;
  const hasListVerb = LIST_VERBS.some((verb) => lower.includes(verb));
  const hasHadithNoun = LIST_NOUNS.some((noun) => lower.includes(noun));
  const wantsList = Boolean((hasListVerb && hasHadithNoun) || countMatch);
  return { wantsList, count };
}

function extractSourceQueryFromQuestion(question: string): string | null {
  const match = question.match(
    /\b(?:from|in)\s+([^?.!]+?)(?:\s+(?:about|on|regarding|related to)\b|[?.!]|$)/i,
  );
  if (!match?.[1]) return null;
  const cleaned = match[1].replace(/["“”]/g, "").replace(/[,:;]+$/, "").trim();
  if (!cleaned || /\b\d+\b/.test(cleaned)) return null;
  return cleaned;
}

function extractTopicQuery(question: string): string | null {
  const match = question.match(
    /\b(?:about|on|regarding|related to)\s+([^?.!]+?)(?:\s+(?:from|in|within)\b|[?.!]|$)/i,
  );
  if (!match?.[1]) return null;
  const cleaned = match[1].replace(/["“”]/g, "").trim();
  return cleaned || null;
}

function isNarratorNetworkQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  return NARRATOR_NETWORK_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function fetchListHadithIdsWithTopic(
  sourceId: number | null,
  limit: number,
  topicTerms: string[],
): Promise<number[]> {
  const client = await getClient();
  try {
    const patterns = topicTerms.map((term) => `%${term}%`);
    const { rows } = await client.query<{ id: number }>(
      `
        SELECT h.id
        FROM hadith h
        JOIN matn m ON m.id = h.matn_id
        LEFT JOIN book b ON b.id = h.book_id
        LEFT JOIN chapter c ON c.id = h.chapter_id
        WHERE h.deleted_at IS NULL
          AND ($1::int IS NULL OR h.source_id = $1)
          AND (
            m.text_en ILIKE ANY($2)
            OR b.name ILIKE ANY($2)
            OR c.name ILIKE ANY($2)
            OR h.location ILIKE ANY($2)
            OR h.sanad ILIKE ANY($2)
          )
        ORDER BY h.id
        LIMIT $3
      `,
      [sourceId, patterns, Math.min(Math.max(1, limit), 20)],
    );
    return rows.map((row) => row.id);
  } finally {
    client.release();
  }
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
    contextHadithId: asNumber(filtersRaw.contextHadithId),
    contextHadithIds: asNumberArray(filtersRaw.contextHadithIds),
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
  retrievalMode?: string;
  retrievalScores?: unknown;
  seedIds?: number[];
  kgCoverage?: unknown;
}) {
  const client = await getClient();
  try {
    await client.query(
      `
        INSERT INTO rag_logs
          (question, filters, retrieved_ids, model, prompt_tokens, completion_tokens, total_tokens, response, citations, retrieval_mode, retrieval_scores, seed_ids, kg_coverage)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        params.retrievalMode ?? null,
        params.retrievalScores ? JSON.stringify(params.retrievalScores) : null,
        params.seedIds ?? null,
        params.kgCoverage ? JSON.stringify(params.kgCoverage) : null,
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
    const contextHadithIds =
      filters.contextHadithIds && filters.contextHadithIds.length
        ? filters.contextHadithIds
        : filters.contextHadithId
          ? [filters.contextHadithId]
          : [];
    const contextHadithId = contextHadithIds[0];
    const parsedSourceNumbers = parseSourceNumbersFromQuestion(question);
    const parsedSourceNumber = parsedSourceNumbers[0] ?? null;
    const resolvedSourceNumber = await resolveSourceNumberQuestion(question);
    const heuristicIntent = inferRagIntent(question);
    const heuristicHadithId = "hadithId" in heuristicIntent ? heuristicIntent.hadithId : undefined;
    const routerDecision = await routeRagIntent({ question, contextHadithId });
    const useRouter = Boolean(routerDecision && (routerDecision.confidence ?? 1) >= 0.55);
    const intentType = useRouter ? routerDecision!.intent : heuristicIntent.type;
    const intentHadithId = useRouter
      ? routerDecision?.hadithId
      : heuristicHadithId;
    const intentNarratorId = useRouter
      ? routerDecision?.narratorId
      : "narratorId" in heuristicIntent
        ? heuristicIntent.narratorId
        : undefined;
    const intentNarratorName = useRouter
      ? routerDecision?.narratorName
      : "narratorName" in heuristicIntent
        ? heuristicIntent.narratorName
        : undefined;
    const intentDepth =
      !useRouter && heuristicIntent.type === "narrator-network"
        ? heuristicIntent.depth
        : undefined;
    const hasSourceNumber = Boolean(parsedSourceNumber);
    const hasExplicitHadithSignal = Boolean(hasSourceNumber || heuristicHadithId);
    const explicitHadithId = hasSourceNumber
      ? resolvedSourceNumber?.hadithId
      : heuristicHadithId ?? resolvedSourceNumber?.hadithId;
    const narratorDetailName = extractNarratorDetailName(question);
    const listSignal = detectListIntent(question);

    const isContextualQuestion = (value: string) => {
      const lower = value.toLowerCase();
      return [
        "this hadith",
        "that hadith",
        "tell me more",
        "more info",
        "all info",
        "all information",
        "details",
        "explain it",
        "explain this",
        "about it",
        "its narrators",
        "its chain",
      ].some((phrase) => lower.includes(phrase));
    };
    const hasExplicitReference =
      Boolean(hasExplicitHadithSignal) || Boolean(intentNarratorId) || Boolean(narratorDetailName);
    const contextualFallback = Boolean(contextHadithId && !hasExplicitReference && isContextualQuestion(question));
    const shouldUseContext =
      contextualFallback ||
      (useRouter ? Boolean(routerDecision?.useContext && contextHadithId && !hasExplicitReference) : contextualFallback);
    const shouldForceHadith = Boolean(shouldUseContext || hasExplicitHadithSignal || explicitHadithId);
    const shouldAllowHadithIntent = Boolean(shouldUseContext || hasExplicitHadithSignal);
    const effectiveIntentType =
      intentType === "hadith" && !shouldAllowHadithIntent ? "semantic" : intentType;

    const shouldHandleList = (effectiveIntentType === "list" && useRouter) || listSignal.wantsList;
    if (shouldHandleList && !shouldForceHadith) {
      const requestedCount = clampCount(routerDecision?.count ?? listSignal.count ?? limit ?? 5, limit ?? 5);
      const sourceQuery = routerDecision?.source ?? extractSourceQueryFromQuestion(question);
      let sourceMatch: { id: number; name: string } | null = null;
      if (sourceQuery) {
        const sources = await findSourcesByName(sourceQuery, 1);
        sourceMatch = sources[0] ?? null;
        if (!sourceMatch) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: SOURCE_NOT_FOUND,
            citations: [],
          });
          return NextResponse.json({ answer: SOURCE_NOT_FOUND, citations: [] });
        }
      }
      const topicQuery = extractTopicQuery(question);
      const topicTerms = topicQuery ? [] : extractTopicTerms(question);
      const listFilters = {
        ...structuredFilters,
        ...(sourceMatch?.name ? { source: sourceMatch.name } : sourceQuery ? { source: sourceQuery } : {}),
      };
      let ids: number[] = [];
      if (topicQuery) {
        ids = await searchHadithIdsByQuery({
          text: topicQuery,
          filters: listFilters,
          limit: requestedCount,
        });
      } else if (topicTerms.length) {
        ids = await searchHadithIdsByQuery({
          text: topicTerms.join(" "),
          filters: listFilters,
          limit: requestedCount,
        });
        if (!ids.length) {
          ids = await fetchListHadithIdsWithTopic(sourceMatch?.id ?? null, requestedCount, topicTerms);
        }
      } else {
        ids = await fetchListHadithIds(sourceMatch?.id ?? null, requestedCount);
      }
      if (!ids.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const hadiths = await getHadithByIds(ids);
      const citations = hadiths.map((hadith) => buildCitation(hadith));
      const response = formatListAnswer(hadiths, sourceMatch?.name ?? sourceQuery);
      await logRagInteraction({
        question,
        filters,
        retrievedIds: ids,
        response,
        citations,
      });
      return NextResponse.json({
        answer: response,
        citations,
        retrieved: ids.map((id) => ({ hadithId: id })),
      });
    }

    if (parsedSourceNumbers.length > 1) {
      const resolvedPairs = await Promise.all(parsedSourceNumbers.map((match) => resolveSourceNumberMatch(match)));
      const resolvedIds = Array.from(
        new Set(
          resolvedPairs
            .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair))
            .map((pair) => pair.hadithId),
        ),
      );
      if (resolvedIds.length) {
        const baseResults = await retrieveHadithByIds(resolvedIds);
        if (!baseResults.length) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: SAFE_FALLBACK,
            citations: [],
          });
          return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
        }
        const results = await mergeContextResults(baseResults, contextHadithIds);
        const detailIds = buildContextDetailIds(results, contextHadithIds, MAX_CONTEXT_DETAILS);
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
          retrieved: results,
        });
      }
    }

    if (effectiveIntentType === "chain") {
      let hadithId = intentHadithId ?? (shouldUseContext ? contextHadithId : undefined);
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

    if (effectiveIntentType === "variants") {
      let hadithId = intentHadithId ?? (shouldUseContext ? contextHadithId : undefined);
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

    if (narratorDetailName && !isNarratorNetworkQuestion(question)) {
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
        if (!detail) {
          const aliasMatches = await findNarratorsByAlias(narratorDetailName);
          if (aliasMatches.length > 1) {
            const options = aliasMatches.map((match) => `${match.name} (ID ${match.id})`).join(", ");
            const response = `I found multiple narrators matching "${narratorDetailName}": ${options}. Please specify the narrator id.`;
            await logRagInteraction({
              question,
              filters,
              retrievedIds: aliasMatches.map((match) => match.id),
              response,
              citations: [],
            });
            return NextResponse.json({ answer: response, citations: [] });
          }
          if (aliasMatches.length === 1) {
            detail = await getNarratorDetailsById(aliasMatches[0].id);
          }
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

    if (effectiveIntentType === "narrator-network") {
      const depth = intentDepth ?? 2;
      let narratorId = intentNarratorId;
      let narratorName = intentNarratorName;

      if (!narratorId && !narratorName && shouldUseContext && contextHadithId) {
        const hadith = await getHadithById(String(contextHadithId));
        if (!hadith) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [contextHadithId],
            response: SAFE_FALLBACK,
            citations: [],
          });
          return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
        }
        const response = formatNarratorChainDetails(hadith);
        const citations = [buildCitation(hadith)];
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [contextHadithId],
          response,
          citations,
        });
        return NextResponse.json({ answer: response, citations });
      }

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

    if (effectiveIntentType === "hadith" || shouldUseContext || shouldForceHadith) {
      let resolvedHadithId: number | undefined;
      if (hasSourceNumber) {
        resolvedHadithId = resolvedSourceNumber?.hadithId;
      }
      if (!resolvedHadithId) {
        resolvedHadithId =
          effectiveIntentType === "hadith"
            ? hasExplicitHadithSignal
              ? heuristicHadithId ?? intentHadithId
              : undefined
            : shouldUseContext
              ? contextHadithId!
              : undefined;
      }
      if (!resolvedHadithId && !hasSourceNumber && resolvedSourceNumber?.hadithId) {
        resolvedHadithId = resolvedSourceNumber.hadithId;
      }
      if (!resolvedHadithId && parsedSourceNumber) {
        const sources = await findSourcesByName(parsedSourceNumber.sourceQuery, 5);
        if (!sources.length) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: SOURCE_NOT_FOUND,
            citations: [],
          });
          return NextResponse.json({ answer: SOURCE_NOT_FOUND, citations: [] });
        }
        if (sources.length > 1) {
          const options = sources.map((source) => `${source.name} (ID ${source.id})`).join(", ");
          const response = `I found multiple sources matching "${parsedSourceNumber.sourceQuery}": ${options}. Please specify the source id.`;
          await logRagInteraction({
            question,
            filters,
            retrievedIds: sources.map((source) => source.id),
            response,
            citations: [],
          });
          return NextResponse.json({ answer: response, citations: [] });
        }
        resolvedHadithId =
          (await findHadithIdBySourceAndNumber(sources[0].id, parsedSourceNumber.number)) ?? undefined;
        if (!resolvedHadithId) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: HADITH_NOT_FOUND_MESSAGE,
            citations: [],
          });
          return NextResponse.json({ answer: HADITH_NOT_FOUND_MESSAGE, citations: [] });
        }
      }
      if (!resolvedHadithId) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_ID_MESSAGE,
          citations: [],
        });
        return NextResponse.json({ answer: REQUIRE_ID_MESSAGE, citations: [] });
      }
      const baseResults = await retrieveHadithByIds([resolvedHadithId]);
      if (!baseResults.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const results = await mergeContextResults(baseResults, contextHadithIds);
      const detailIds = buildContextDetailIds(results, contextHadithIds, MAX_CONTEXT_DETAILS);
      const hadithDetails = await getHadithByIds(detailIds);
      const hadithMap = new Map(hadithDetails.map((item) => [Number(item.id), item]));
      const graphMap = await loadGraphContext(detailIds, 1);
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

    if (hasExplicitFilters) {
      const structuredIds = await searchHadithIdsByQuery({
        text: question,
        filters: structuredFilters,
        limit: MAX_STRUCTURED_RESULTS,
      });
      if (structuredIds.length) {
        const baseResults = await retrieveHadithByIds(structuredIds);
        const results = await mergeContextResults(baseResults, contextHadithIds);
        const detailIds = buildContextDetailIds(results, contextHadithIds, MAX_CONTEXT_DETAILS);
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
          retrievalMode: "structured",
          retrievalScores: buildRetrievalScores(results),
        });
        return NextResponse.json({
          answer: answer.answer,
          citations: answer.citations,
          graph,
          retrieved: results,
        });
      }
    }

    const seedCandidates = await searchHadithIdsByQuery({
      text: question,
      filters: structuredFilters,
      limit: 8,
    });
    const seedIds = Array.from(new Set([...(contextHadithIds ?? []), ...seedCandidates]));

    const hybridResults = await retrieveHadithForQuestionHybrid({
      question,
      limit,
      model: process.env.EMBEDDING_MODEL,
      filters,
      includeProvenance: true,
      seedHadithIds: seedIds,
    });
    let retrievalMode: "hybrid" | "pg" = "hybrid";
    const results =
      hybridResults.results.length > 0
        ? hybridResults.results
        : await retrieveHadithForQuestion({ question, ...filters, limit });
    if (hybridResults.results.length === 0 && results.length > 0) {
      retrievalMode = "pg";
    }

    if (!results.length) {
      const structuredIds = await searchHadithIdsByQuery({
        text: question,
        filters: structuredFilters,
        limit: MAX_STRUCTURED_RESULTS,
      });
      if (structuredIds.length) {
        const baseResults = await retrieveHadithByIds(structuredIds);
        const structuredResults = await mergeContextResults(baseResults, contextHadithIds);
        const detailIds = buildContextDetailIds(structuredResults, contextHadithIds, MAX_CONTEXT_DETAILS);
        const structuredDetails = await getHadithByIds(detailIds);
        const structuredMap = new Map(structuredDetails.map((item) => [Number(item.id), item]));
        const graphMap = await loadGraphContext(detailIds, MAX_GRAPH_CONTEXT);
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
          retrievalMode: "structured",
          retrievalScores: buildRetrievalScores(structuredResults),
          seedIds,
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
        retrievalMode,
        seedIds,
      });
      return NextResponse.json({
        answer: SAFE_FALLBACK,
        citations: [],
        retrieved: [],
      });
    }

    const mergedResults = await mergeContextResults(results, contextHadithIds);
    const detailIds = buildContextDetailIds(mergedResults, contextHadithIds, MAX_CONTEXT_DETAILS);
    const hadithDetails = await getHadithByIds(detailIds);
    const hadithMap = new Map(hadithDetails.map((item) => [Number(item.id), item]));
    const graphMap = await loadGraphContext(detailIds, MAX_GRAPH_CONTEXT);
    const context = buildRagContext(mergedResults, hadithMap, graphMap, hybridResults.provenance ?? null);
    const answer = await generateRagAnswer({ question, results: mergedResults, context });
    const answerGraph = await buildAnswerGraph(answer.citations);
    const graph = mergeGraphs(answerGraph, hybridResults.provenance ?? null);

    const coverageRows = mergedResults.length
      ? await fetchHadithCoverage(mergedResults.map((r) => r.hadithId))
      : [];
    const kgCoverage = summarizeCoverageForQuery(coverageRows);

    await logRagInteraction({
      question,
      filters,
      retrievedIds: mergedResults.map((r) => r.hadithId),
      modelUsed: answer.modelUsed,
      promptTokens: answer.usage?.promptTokens,
      completionTokens: answer.usage?.completionTokens,
      totalTokens: answer.usage?.totalTokens,
      response: answer.answer,
      citations: answer.citations,
      retrievalMode,
      retrievalScores: buildRetrievalScores(mergedResults),
      seedIds,
      kgCoverage,
    });

    return NextResponse.json({
      answer: answer.answer,
      citations: answer.citations,
      graph,
      retrieved: mergedResults, // include for now; can be trimmed in production
    });
  } catch (error) {
    console.error("[api/rag/query] Failed", error);
    return NextResponse.json({ error: "Unable to process request" }, { status: 500 });
  }
}
