import { NextRequest, NextResponse } from "next/server";
import { retrieveHadithByIds, retrieveHadithForQuestion } from "@/server/rag/retriever";
import { generateRagAnswer } from "@/server/rag/generator";
import { buildRagContext } from "@/server/rag/context";
import { inferRagIntent } from "@/server/rag/intent";
import { routeRagIntent } from "@/server/rag/router";
import {
  buildSourceNumberMatchesFromSources,
  parseSourceNumbersFromQuestion,
  resolveSourceNumberMatch,
} from "@/server/rag/source-number";
import { loadGraphContext } from "@/server/rag/graph-context";
import { retrieveHadithForQuestionHybrid } from "@/server/rag/kg-retriever";
import { DEFAULT_EMBEDDING_PROFILE, getAugmentedEmbeddingProfile } from "@/server/rag/embeddings";
import {
  findBooksByName,
  findBooksByNumber,
  findChaptersByName,
  findHadithIdBySourceAndNumber,
  findUniqueHadithIdByNumber,
  findSourcesByName,
  findSourcesMentionedInQuestion,
} from "@/server/rag/hadith-lookup";
import {
  findExactNarratorByName,
  findHadithIdsByNarratorName,
  findNarratorIntersectionForHadiths,
  findHadithIdsByNarratorPair,
  fetchTopNarratorsByUniqueChains,
  fetchChainHeadNarrators,
  fetchNarratorsByTier,
  fetchTopNarratorsByHadithIds,
  fetchNarratorsWithSingleOccurrence,
  countUniqueNarrators,
  findNarratorsByNameInHadith,
  findNarratorsByName,
  findNarratorsByAlias,
  fetchTopNarrators,
  getNarratorDetailsById,
  getNarratorDetailsByName,
} from "@/server/rag/narrator";
import { fetchHadithIdsWithSameMatnDifferentChains, fetchMatnGroupsForHadithIds } from "@/server/rag/matn";
import { extractStructuredFilters, searchHadithIdsByQuery } from "@/server/rag/search";
import {
  compareChains,
  findHadithIdsByMatnSimilarity,
  findMatnPairsByPrefix,
  loadHadithInsights,
} from "@/server/rag/compare";
import { fetchAnswerGraph, fetchNarratorNetwork, fetchVariants } from "@/server/graph/queries";
import { getHadithById, getHadithByIds } from "@/features/hadith/server/hadith-service";
import { HadithInsight } from "@/features/hadith/types";
import { RagCitation, RagFilters, RagGraph, RagResult } from "@/types/rag";
import { getClient } from "@/server/db/client";
import { fetchHadithCoverage, summarizeCoverageForQuery } from "@/server/eval/kg";

const SAFE_FALLBACK =
  "I couldn't find enough relevant hadith in the context I have to answer that safely.";
const SOURCE_NOT_FOUND =
  "I don't recognize that source name in the database. Please check the spelling and try again.";
const REQUIRE_ID_MESSAGE =
  "Please include the source name with the hadith number (e.g., \"Sahih al-Bukhari 4014\").";
const REQUIRE_SOURCE_MESSAGE =
  "I need the source name with that hadith number (e.g., \"Sahih al-Bukhari 4014\").";
const REQUIRE_COMPARE_SOURCE_MESSAGE =
  "Please include the source name with each hadith number (e.g., \"Compare Bukhari 2398 and 2399\").";
const REQUIRE_NARRATOR_MESSAGE =
  "Please share a narrator name or id (e.g., \"Narrator ID 45\" or \"connected to Abu Huraira\").";
const BOOK_NOT_FOUND =
  "I couldn't find that book in the database. Please check the spelling or try the source name instead.";
const CHAPTER_NOT_FOUND =
  "I couldn't find that chapter in the database. Please check the spelling or try the book name instead.";
const REQUIRE_CONTEXT_MESSAGE =
  "Select a hadith from the results, or share a source name with hadith number, and I can answer from that context.";
const HADITH_NOT_FOUND_MESSAGE =
  "I couldn't find that number under the specified source. Please double-check the source and number.";
const CONTEXT_ONLY_MESSAGE =
  "There is no info for that within this context of selected hadiths.";
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
const CHAIN_KEYWORDS = ["chain", "isnad", "sanad"];
const CHAIN_TYPE_KEYWORDS = ["chain type", "isnad type", "sanad type", "chain classification"];
const COMPARE_KEYWORDS = [
  "compare",
  "difference",
  "different",
  "versus",
  "vs",
  "same",
  "similar",
  "nearly identical",
  "parallel",
  "variants",
  "variant",
  "same wording",
  "similar wording",
  "same matn",
  "similar matn",
];
const MATN_SIMILARITY_THRESHOLD = 0.75;
const NARRATOR_NETWORK_KEYWORDS = [
  "connected",
  "connection",
  "network",
  "hops",
  "hop",
  "ego network",
  "graph",
];
const NARRATOR_AGGREGATE_KEYWORDS = [
  "most frequent",
  "most common",
  "most mentioned",
  "appear most",
  "appears most",
  "top narrators",
  "top narrator",
  "frequent narrators",
  "common narrators",
];
const GRADE_KEYWORDS = ["grade", "graded", "sahih", "hasan", "daif", "dhaif", "weak", "authentic"];
const ATTRIBUTION_KEYWORDS = ["attribution", "marfu", "marfū", "mawquf", "maqtu", "maqṭu", "mursal"];
const NARRATION_LEVEL_KEYWORDS = [
  "narration level",
  "level of narration",
  "mutawatir",
  "mashhur",
  "aziz",
  "gharib",
  "fard",
];
const TRANSMISSION_METHOD_KEYWORDS = [
  "transmission method",
  "method of transmission",
  "tariq",
  "turuq",
];
const VARIANT_KEYWORDS = ["variant", "variants", "across sources", "other sources", "different sources"];
const IDENTIFIER_KEYWORDS = [
  "identifier",
  "identifier scheme",
  "scheme key",
  "reference id",
  "reference number",
];
const DEBUG_LOG = process.env.RAG_DEBUG_LOG === "true";

const BOOK_NUMBER_REGEX = /\bbook\s+(\d{1,4})\b/i;
const NARRATED_BY_REGEX = /\bnarrated by\s+([^?.!]+?)(?:\s+in\s+|[?.!]|$)/i;
const CHAIN_INTERSECTION_KEYWORDS = ["both hadith", "in both", "shared narrators", "narrators in both"];
const CHAIN_COUNT_KEYWORDS = ["how many narrators", "number of narrators", "narrators between"];
const TEACHER_KEYWORDS = ["teachers of", "teacher of"];
const UNIQUE_CHAIN_KEYWORDS = ["unique chains", "most unique chains"];
const SINGLE_OCCURRENCE_KEYWORDS = ["only appear once", "appear once", "single occurrence"];
const UNIQUE_NARRATOR_COUNT_KEYWORDS = ["total unique narrators", "how many unique narrators"];
const TABI_KEYWORDS = ["tābi", "tabi", "tabi'i", "tābi'i"];
const SAME_MATN_KEYWORDS = ["same matn", "same wording", "same text"];
const DIFFERENT_CHAIN_KEYWORDS = ["different isnad", "different chain", "different chains"];
const MULTIPLE_CHAIN_KEYWORDS = ["multiple chains", "more than one chain", "multiple isnad"];
const TRANSMISSION_PATH_KEYWORDS = ["transmission paths", "transmission path", "unique paths"];
const KNOWLEDGE_TAKEN_KEYWORDS = ["knowledge is taken away", "knowledge will be taken away", "knowledge is taken"];
const MAX_LIST_RESULTS = 50;

function logRagDebug(event: string, payload: Record<string, unknown>) {
  if (!DEBUG_LOG) return;
  console.info(`[rag] ${event}`, payload);
}

function buildCitation(hadith: HadithInsight): RagCitation {
  return {
    hadithId: Number(hadith.id),
    displayNumber: String(hadith.details.hadithNumber),
    source: hadith.details.source,
  };
}

function formatChainAnswer(hadith: HadithInsight): string {
  const label = formatHadithLabel(hadith);
  if (!hadith.chain.length) {
    return `I don't have chain data stored for ${label} yet.`;
  }
  const chainNames = hadith.chain.map((node) => node.name).join(" -> ");
  return `Here is the chain I have for ${label}: ${chainNames}.`;
}

function formatVariantsAnswer(
  hadith: HadithInsight,
  variants: Array<{ hadithId: number; displayNumber: string; source: string; similarityReason: string }>,
  variantMap?: Map<number, HadithInsight>,
): string {
  const label = formatHadithLabel(hadith);
  if (!variants.length) {
    return `I don't see linked variants in the graph for ${label}.`;
  }
  const items = variants.slice(0, 10).map((variant) => {
    const mapped = variantMap?.get(variant.hadithId);
    const number = mapped?.details.hadithNumber ?? variant.displayNumber;
    const source = mapped?.details.source ?? variant.source;
    return `${source} ${number} (${variant.similarityReason})`;
  });
  return `I found these linked variants for ${label}: ${items.join("; ")}.`;
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
    return `I don't see connected narrators for ${narratorName} within ${depth} hops.`;
  }
  const list = narrators.slice(0, 25).join(", ");
  const suffix = narrators.length > 25 ? " (truncated)" : "";
  return `Within ${depth} hops of ${narratorName}, I see: ${list}${suffix}.`;
}

function formatNarratorChainDetails(hadith: HadithInsight): string {
  const label = formatHadithLabel(hadith);
  if (!hadith.chain.length) {
    return `I don't have chain data stored for ${label} yet.`;
  }
  const items = hadith.chain.map((node) => {
    const bits = [node.name];
    if (node.type === "prophet") bits.push("Prophet");
    if (node.classificationDetail?.title) bits.push(node.classificationDetail.title);
    if (node.reliabilityDetail?.title) bits.push(node.reliabilityDetail.title);
    if (node.lifespan) bits.push(node.lifespan);
    return bits.join(" — ");
  });
  return `Here are the narrators for ${label}, with any available notes: ${items.join("; ")}.`;
}

function formatListAnswer(
  hadiths: HadithInsight[],
  sourceLabel?: string | null,
  options?: { limit?: number; requestedAll?: boolean },
): string {
  if (!hadiths.length) return SAFE_FALLBACK;
  const prefix = sourceLabel ? `from ${sourceLabel}` : "from your collection";
  const items = hadiths.map((hadith, index) => {
    const label = formatHadithLabel(hadith);
    const snippet = hadith.matn.split("\n").map((line) => line.trim()).find(Boolean) ?? hadith.matn;
    const text = snippet.length > 180 ? `${snippet.slice(0, 180)}…` : snippet;
    return `${index + 1}. ${text} (${label})`;
  });
  const maybeTruncated =
    Boolean(options?.requestedAll && options?.limit && hadiths.length >= options.limit) && options?.limit;
  const suffix = maybeTruncated ? ` Showing up to ${options!.limit}.` : "";
  return `I found ${hadiths.length} ${hadiths.length === 1 ? "hadith" : "hadiths"} ${prefix}: ${items.join(" ")}${suffix}`;
}

async function fetchListHadithIds(
  sourceId: number | null,
  limit: number,
  bookIds?: number[] | null,
  chapterIds?: number[] | null,
): Promise<number[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<{ id: number }>(
      `
        SELECT id
        FROM hadith
        WHERE deleted_at IS NULL
          AND ($1::int IS NULL OR source_id = $1)
          AND ($2::int[] IS NULL OR book_id = ANY($2))
          AND ($3::int[] IS NULL OR chapter_id = ANY($3))
        ORDER BY id
        LIMIT $4
      `,
      [
        sourceId,
        bookIds?.length ? bookIds : null,
        chapterIds?.length ? chapterIds : null,
        Math.min(Math.max(1, limit), 20),
      ],
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

type AttributeIntent = {
  wantsAttribute: boolean;
  wantsGrade: boolean;
  wantsAttribution: boolean;
  wantsChainType: boolean;
  wantsNarrationLevel: boolean;
  wantsTransmissionMethod: boolean;
  wantsIdentifiers: boolean;
};

function isGradeQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  if (!GRADE_KEYWORDS.some((keyword) => lower.includes(keyword))) return false;
  return /\b(is|grade|graded|status|classification)\b/i.test(question);
}

function isAttributionQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  if (!ATTRIBUTION_KEYWORDS.some((keyword) => lower.includes(keyword))) return false;
  return /\b(is|attribution|marfu|marfū|mawquf|maqtu|maqṭu|mursal)\b/i.test(question);
}

function detectAttributeIntent(question: string): AttributeIntent {
  const lower = question.toLowerCase();
  const wantsGrade = isGradeQuestion(question);
  const wantsAttribution = isAttributionQuestion(question);
  const wantsChainType = CHAIN_TYPE_KEYWORDS.some((keyword) => lower.includes(keyword));
  const wantsNarrationLevel = NARRATION_LEVEL_KEYWORDS.some((keyword) => lower.includes(keyword));
  const wantsTransmissionMethod = TRANSMISSION_METHOD_KEYWORDS.some((keyword) => lower.includes(keyword));
  const wantsIdentifiers = IDENTIFIER_KEYWORDS.some((keyword) => lower.includes(keyword));
  const wantsAttribute =
    wantsGrade ||
    wantsAttribution ||
    wantsChainType ||
    wantsNarrationLevel ||
    wantsTransmissionMethod ||
    wantsIdentifiers;
  return {
    wantsAttribute,
    wantsGrade,
    wantsAttribution,
    wantsChainType,
    wantsNarrationLevel,
    wantsTransmissionMethod,
    wantsIdentifiers,
  };
}

function formatAttributeAnswer(hadiths: HadithInsight[], intent: AttributeIntent): string {
  const items = hadiths.map((hadith) => {
    const label = `${hadith.details.source} ${hadith.details.hadithNumber}`;
    const parts: string[] = [];
    if (intent.wantsGrade) {
      const primary = hadith.gradedGrades?.find((grade) => grade.isPrimary) ?? hadith.gradedGrades?.[0];
      const gradeTitle = primary?.grade?.title ?? hadith.details.grading ?? null;
      const scholar = primary?.scholar?.name ?? null;
      if (gradeTitle) {
        parts.push(`Grade: ${gradeTitle}${scholar ? ` (by ${scholar})` : ""}`);
      } else {
        parts.push("Grade: not stored");
      }
    }
    if (intent.wantsAttribution) {
      const attribution = hadith.sourceTypeDetails?.[0]?.title ?? hadith.sourceTypes?.[0] ?? null;
      parts.push(attribution ? `Attribution: ${attribution}` : "Attribution: not stored");
    }
    if (intent.wantsChainType) {
      const chainType = hadith.chainTypeDetails?.[0]?.title ?? hadith.chainTypes?.[0] ?? null;
      parts.push(chainType ? `Chain type: ${chainType}` : "Chain type: not stored");
    }
    if (intent.wantsNarrationLevel) {
      const narration = hadith.narrationLevelDetail?.title ?? hadith.narrationLevel ?? null;
      parts.push(narration ? `Narration level: ${narration}` : "Narration level: not stored");
    }
    if (intent.wantsTransmissionMethod) {
      const methods = Array.from(
        new Set(
          hadith.chain
            .map((node) => node.transmissionMethodDetail?.title)
            .filter((value): value is string => Boolean(value)),
        ),
      );
      parts.push(methods.length ? `Transmission method: ${methods.join(", ")}` : "Transmission method: not stored");
    }
    if (intent.wantsIdentifiers) {
      const identifiers = hadith.identifiers?.map((id) => {
        const suffix = id.isPrimary ? " (primary)" : "";
        return `${id.schemeKey}:${id.identifier}${suffix}`;
      });
      parts.push(identifiers?.length ? `Identifiers: ${identifiers.join(", ")}` : "Identifiers: not stored");
    }
    if (!parts.length) {
      return `${label} does not have stored attribute data.`;
    }
    return `${label}: ${parts.join(" · ")}`;
  });
  if (items.length === 1) return items[0];
  return `Here is what I have: ${items.join(" ")}`;
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
    return `I only have the name for ${detail.name} in the narrator table so far.`;
  }
  return `Here is what I have for ${detail.name}: ${parts.join(" · ")}.`;
}

function extractNarratorDetailName(question: string): string | null {
  const patterns = [
    /tell me more about\s+([^?.!]+?)(?:[?.!]|$)/i,
    /tell me about\s+([^?.!]+?)(?:[?.!]|$)/i,
    /details about\s+([^?.!]+?)(?:[?.!]|$)/i,
    /details of\s+([^?.!]+?)(?:[?.!]|$)/i,
    /i want details about\s+([^?.!]+?)(?:[?.!]|$)/i,
    /i want details of\s+([^?.!]+?)(?:[?.!]|$)/i,
    /who is\s+([^?.!]+?)(?:[?.!]|$)/i,
    /info about\s+([^?.!]+?)(?:[?.!]|$)/i,
    /info on\s+([^?.!]+?)(?:[?.!]|$)/i,
    /information about\s+([^?.!]+?)(?:[?.!]|$)/i,
    /information on\s+([^?.!]+?)(?:[?.!]|$)/i,
    /details on\s+([^?.!]+?)(?:[?.!]|$)/i,
    /biography of\s+([^?.!]+?)(?:[?.!]|$)/i,
    /bio of\s+([^?.!]+?)(?:[?.!]|$)/i,
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

function looksLikeNarratorName(question: string): string | null {
  const trimmed = question.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  if (/\d/.test(trimmed)) return null;
  if (/[,;:.!?]/.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const blockers = [
    "hadith",
    "narrator",
    "narrators",
    "chain",
    "isnad",
    "sanad",
    "variant",
    "variants",
    "grade",
    "graded",
    "attribution",
    "network",
    "connected",
    "compare",
    "list",
    "show",
    "give",
    "provide",
    "continue",
    "conversation",
    "chat",
    "context",
    "details",
    "info",
    "information",
    "who",
    "what",
    "why",
    "how",
  ];
  if (blockers.some((token) => lower.includes(token))) return null;
  const nameConnector = /(^|\s)(abu|umm|ibn|bin|bint|abd|al)(\s|-|$)/;
  if (!nameConnector.test(lower) && tokens.length <= 2) return null;
  if (tokens.length > 8) return null;
  return trimmed;
}

function formatHadithOptions(matches: HadithInsight[], label: string) {
  const items = matches.slice(0, 6).map((match) => {
    return `${match.details.source} ${match.details.hadithNumber}`;
  });
  return `I found multiple matches for ${label}: ${items.join("; ")}. Which one should I use? Please share the source name and hadith number.`;
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

function detectListIntent(question: string): { wantsList: boolean; count?: number; all?: boolean } {
  const lower = question.toLowerCase();
  const countMatch = lower.match(/\b(\d+)\s+(?:hadith|hadiths|narrations|reports)\b/i);
  const count = countMatch ? Number(countMatch[1]) : undefined;
  const hasListVerb = LIST_VERBS.some((verb) => lower.includes(verb));
  const hasHadithNoun = LIST_NOUNS.some((noun) => lower.includes(noun));
  const wantsAll = hasHadithNoun && /\b(all|every|entire)\b/.test(lower);
  const wantsList = Boolean((hasListVerb && hasHadithNoun) || countMatch);
  return { wantsList, count, all: wantsAll };
}

function extractNarratedByName(question: string): string | null {
  const match = question.match(NARRATED_BY_REGEX);
  if (!match?.[1]) return null;
  const cleaned = match[1].replace(/["“”]/g, "").replace(/[,:;]+$/, "").trim();
  if (!cleaned || cleaned.toLowerCase().includes("hadith")) return null;
  return cleaned;
}

function extractSubchainPair(question: string): { first: string; second: string } | null {
  const match =
    question.match(/\b(?:includes|include|containing|contains)\s+([^?.!]+?)\s*(?:->|→)\s*([^?.!]+?)(?:[?.!]|$)/i) ??
    question.match(/([^?.!]+?)\s*(?:->|→)\s*([^?.!]+?)(?:[?.!]|$)/i);
  if (!match?.[1] || !match?.[2]) return null;
  const first = match[1].replace(/["“”]/g, "").replace(/[,:;]+$/, "").trim();
  const second = match[2].replace(/["“”]/g, "").replace(/[,:;]+$/, "").trim();
  if (!first || !second) return null;
  return { first, second };
}

function hasAnyKeyword(question: string, keywords: string[]) {
  const lower = question.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

async function resolveSourceMatch(question: string): Promise<{ id: number; name: string } | null> {
  const sourceQuery = extractSourceQueryFromQuestion(question);
  if (sourceQuery) {
    const sources = await findSourcesByName(sourceQuery, 1);
    if (sources[0]) return sources[0];
  }
  const mentioned = await findSourcesMentionedInQuestion(question, 1);
  return mentioned[0] ?? null;
}

function extractQuotedMatn(question: string): string | null {
  const match = question.match(/["“”]([^"“”]{6,})["“”]/);
  const text = match?.[1]?.trim();
  return text && text.length >= 6 ? text : null;
}

function extractHadithIdsFromQuestion(question: string): number[] {
  const ids = new Set<number>();
  const patterns = [
    /\bhadith\s*(?:id|#|no\.?|number)?\s*[:#]?\s*(\d+)\b/gi,
  ];
  patterns.forEach((pattern) => {
    for (const match of question.matchAll(pattern)) {
      const raw = match[1];
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) ids.add(Math.trunc(value));
    }
  });
  return Array.from(ids);
}

function extractComparisonNumbers(question: string): number[] {
  const lower = question.toLowerCase();
  if (!COMPARE_KEYWORDS.some((keyword) => lower.includes(keyword))) return [];
  const matches = question.match(/\b\d{1,5}\b/g) ?? [];
  const values = matches.map((match) => Number(match)).filter((value) => Number.isFinite(value) && value > 0);
  return Array.from(new Set(values));
}

type ComparisonSignal = {
  wantsCompare: boolean;
  hadithIds: number[];
  matnQuery?: string | null;
  count: number;
};

function detectComparisonIntent(
  question: string,
  matnFilter?: string | null,
  countHint?: number,
  sourceNumberCount = 0,
  numberCount = 0,
): ComparisonSignal {
  const lower = question.toLowerCase();
  const hasCompareKeyword = COMPARE_KEYWORDS.some((keyword) => lower.includes(keyword));
  const hasChainKeyword = CHAIN_KEYWORDS.some((keyword) => lower.includes(keyword));
  const hasMatnKeyword = lower.includes("matn") || lower.includes("wording") || lower.includes("text");
  const hadithIds = extractHadithIdsFromQuestion(question);
  const matnQuery = matnFilter ?? extractQuotedMatn(question);
  const hasSourcePair = sourceNumberCount >= 2;
  const wantsCompare =
    (hadithIds.length >= 2 && hasCompareKeyword) ||
    (matnQuery && (hasCompareKeyword || hasMatnKeyword)) ||
    (hasCompareKeyword && (hasChainKeyword || hasMatnKeyword || hasSourcePair || numberCount >= 2));
  return {
    wantsCompare,
    hadithIds,
    matnQuery,
    count: clampCount(countHint ?? 2, 2),
  };
}

function formatHadithLabel(hadith: HadithInsight): string {
  return `${hadith.details.source} ${hadith.details.hadithNumber}`;
}

function formatMatnSnippet(hadith: HadithInsight): string {
  const snippet = hadith.matn.split("\n").map((line) => line.trim()).find(Boolean) ?? hadith.matn;
  return snippet.length > 180 ? `${snippet.slice(0, 180)}…` : snippet;
}

function formatChainText(hadith: HadithInsight): string {
  if (!hadith.chain.length) return "No chain data stored.";
  return hadith.chain.map((node) => node.name).join(" -> ");
}

function formatComparisonPairs(
  pairs: Array<{ a: HadithInsight; b: HadithInsight }>,
  descriptor = "of near-identical matn with different chains",
): string {
  if (!pairs.length) return SAFE_FALLBACK;
  const sections = pairs.map((pair, index) => {
    const labelA = formatHadithLabel(pair.a);
    const labelB = formatHadithLabel(pair.b);
    const chainDiff = compareChains(pair.a, pair.b);
    const diffNote = chainDiff.different
      ? chainDiff.onlyA.length || chainDiff.onlyB.length
        ? `Chain differences — only in ${labelA}: ${chainDiff.onlyA.join(", ") || "none"}; only in ${labelB}: ${
            chainDiff.onlyB.join(", ") || "none"
          }.`
        : "Chains differ in order or length."
      : "Chains appear identical in the stored data.";
    return [
      `Pair ${index + 1}:`,
      `${labelA} — ${formatMatnSnippet(pair.a)}`,
      `Chain: ${formatChainText(pair.a)}`,
      `${labelB} — ${formatMatnSnippet(pair.b)}`,
      `Chain: ${formatChainText(pair.b)}`,
      diffNote,
    ].join("\n");
  });
  return `Here ${pairs.length === 1 ? "is" : "are"} ${pairs.length} pair${pairs.length === 1 ? "" : "s"} ${descriptor}:\n${sections.join("\n\n")}`;
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

function extractBookQueryFromQuestion(question: string): string | null {
  const match =
    question.match(/\bbook\s+of\s+([^?.!]+?)(?:\s+(?:in|from|within)\b|[?.!]|$)/i) ??
    question.match(/\bin\s+book\s+([^?.!]+?)(?:\s+(?:in|from|within)\b|[?.!]|$)/i);
  if (!match?.[1]) return null;
  const cleaned = match[1].replace(/["“”]/g, "").replace(/[,:;]+$/, "").trim();
  return cleaned || null;
}

function extractBookNumberFromQuestion(question: string): number | null {
  const match = question.match(BOOK_NUMBER_REGEX);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function extractChapterQueryFromQuestion(question: string): string | null {
  const match =
    question.match(/\bchapter\s+of\s+([^?.!]+?)(?:\s+(?:in|from|within)\b|[?.!]|$)/i) ??
    question.match(/\bin\s+chapter\s+([^?.!]+?)(?:\s+(?:in|from|within)\b|[?.!]|$)/i);
  if (!match?.[1]) return null;
  const cleaned = match[1].replace(/["“”]/g, "").replace(/[,:;]+$/, "").trim();
  return cleaned || null;
}

function extractTopCount(question: string): number | undefined {
  const match = question.match(/\btop\s+(\d+)\b/i) ?? question.match(/\b(\d+)\s+top\b/i);
  if (!match?.[1]) return undefined;
  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? count : undefined;
}

function isNarratorNetworkQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  return NARRATOR_NETWORK_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function isNarratorAggregateQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  if (!lower.includes("narrator")) return false;
  return NARRATOR_AGGREGATE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function fetchListHadithIdsWithTopic(
  sourceId: number | null,
  limit: number,
  topicTerms: string[],
  bookIds?: number[] | null,
  chapterIds?: number[] | null,
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
          AND ($2::int[] IS NULL OR h.book_id = ANY($2))
          AND ($3::int[] IS NULL OR h.chapter_id = ANY($3))
          AND (
            m.text_en ILIKE ANY($4)
            OR b.name ILIKE ANY($4)
            OR c.name ILIKE ANY($4)
            OR h.location ILIKE ANY($4)
            OR h.sanad ILIKE ANY($4)
          )
        ORDER BY h.id
        LIMIT $5
      `,
      [
        sourceId,
        bookIds?.length ? bookIds : null,
        chapterIds?.length ? chapterIds : null,
        patterns,
        Math.min(Math.max(1, limit), 20),
      ],
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
    const contextOnly = contextHadithIds.length > 0;
    const contextSet = new Set(contextHadithIds);
    const attributeIntent = detectAttributeIntent(question);
    let parsedSourceNumbers = parseSourceNumbersFromQuestion(question);
    if (!parsedSourceNumbers.length) {
      const mentionedSources = await findSourcesMentionedInQuestion(question);
      parsedSourceNumbers = buildSourceNumberMatchesFromSources(question, mentionedSources);
    }
    const parsedSourceNumber = parsedSourceNumbers[0] ?? null;
    const resolvedSourceNumber = parsedSourceNumber
      ? await resolveSourceNumberMatch(parsedSourceNumber)
      : null;
    const heuristicIntent = inferRagIntent(question);
    const heuristicHadithId = "hadithId" in heuristicIntent ? heuristicIntent.hadithId : undefined;
    const routerDecision = contextOnly ? null : await routeRagIntent({ question, contextHadithId });
    const useRouter = !contextOnly && Boolean(routerDecision && (routerDecision.confidence ?? 1) >= 0.55);
    const intentType = useRouter ? routerDecision!.intent : heuristicIntent.type;
    const explicitHadithIds = extractHadithIdsFromQuestion(question);
    const hasExplicitHadithNumber = Boolean(parsedSourceNumbers.length || explicitHadithIds.length);
    const routerHadithId = useRouter && hasExplicitHadithNumber ? routerDecision?.hadithId : undefined;
    const intentHadithId = routerHadithId ?? (hasExplicitHadithNumber ? heuristicHadithId : undefined);
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
    const requestedHadithNumber = intentHadithId ?? heuristicHadithId;
    const hasUnscopedNumber = Boolean(requestedHadithNumber && !hasSourceNumber);
    const fallbackUnique = hasUnscopedNumber
      ? await findUniqueHadithIdByNumber(requestedHadithNumber!)
      : null;
    const hasExplicitHadithSignal = Boolean(hasSourceNumber || requestedHadithNumber);
    const explicitHadithId =
      (hasSourceNumber ? resolvedSourceNumber?.hadithId : undefined) ?? fallbackUnique?.hadithId;
    const explicitHadithIdOutsideContext =
      contextOnly && explicitHadithId ? !contextSet.has(explicitHadithId) : false;
    const narratorDetailName = extractNarratorDetailName(question) ?? looksLikeNarratorName(question);
    const narratedByName = extractNarratedByName(question);
    const bookNumber = extractBookNumberFromQuestion(question);
    const subchainPair = extractSubchainPair(question);
    const listSignal = detectListIntent(question);
    const comparisonNumbers = extractComparisonNumbers(question);
    const comparisonSignal = detectComparisonIntent(
      question,
      structuredFilters.matn,
      listSignal.count,
      parsedSourceNumbers.length,
      comparisonNumbers.length,
    );
    const wantsFullIsnadMatn =
      hasAnyKeyword(question, CHAIN_KEYWORDS) &&
      question.toLowerCase().includes("matn") &&
      Boolean(requestedHadithNumber || parsedSourceNumber);
    const wantsNarratorIntersection =
      hasAnyKeyword(question, CHAIN_INTERSECTION_KEYWORDS) &&
      (comparisonNumbers.length >= 2 || parsedSourceNumbers.length >= 2);
    const wantsChainCount =
      hasAnyKeyword(question, CHAIN_COUNT_KEYWORDS) &&
      question.toLowerCase().includes("prophet") &&
      Boolean(requestedHadithNumber || parsedSourceNumber);
    const wantsSubchain = Boolean(subchainPair);
    const wantsTeachers = hasAnyKeyword(question, TEACHER_KEYWORDS) && question.toLowerCase().includes("bukhari");
    const wantsUniqueChains = hasAnyKeyword(question, UNIQUE_CHAIN_KEYWORDS);
    const wantsSingleOccurrence = hasAnyKeyword(question, SINGLE_OCCURRENCE_KEYWORDS);
    const wantsUniqueNarratorCount = hasAnyKeyword(question, UNIQUE_NARRATOR_COUNT_KEYWORDS);
    const wantsTabi = hasAnyKeyword(question, TABI_KEYWORDS) && question.toLowerCase().includes("narrator");
    const wantsSameMatnDifferentChains =
      hasAnyKeyword(question, SAME_MATN_KEYWORDS) && hasAnyKeyword(question, DIFFERENT_CHAIN_KEYWORDS);
    const wantsMultipleChains = hasAnyKeyword(question, MULTIPLE_CHAIN_KEYWORDS);
    const wantsTransmissionPaths = hasAnyKeyword(question, TRANSMISSION_PATH_KEYWORDS);
    const wantsKnowledgeChain =
      hasAnyKeyword(question, KNOWLEDGE_TAKEN_KEYWORDS) && hasAnyKeyword(question, CHAIN_KEYWORDS);
    const wantsNarratorsMostAssociated =
      question.toLowerCase().includes("narrators") &&
      question.toLowerCase().includes("associated") &&
      (question.toLowerCase().includes("hadith") || question.toLowerCase().includes("hadiths"));
    const hasAttributeFilters = Boolean(
      structuredFilters.tag ||
        structuredFilters.grade ||
        structuredFilters.scholar ||
        structuredFilters.identifier ||
        structuredFilters.attribution ||
        structuredFilters.chainType ||
        structuredFilters.narrationLevel ||
        structuredFilters.transmissionMethod ||
        structuredFilters.narrator ||
        structuredFilters.sanad,
    );
    const augmentedProfile = getAugmentedEmbeddingProfile();
    const embeddingProfile =
      augmentedProfile && (attributeIntent.wantsAttribute || hasAttributeFilters)
        ? augmentedProfile
        : DEFAULT_EMBEDDING_PROFILE;

    logRagDebug("intent", {
      intent: intentType,
      useRouter,
      contextOnly,
      attributeIntent,
      hasAttributeFilters,
      embeddingProfile: embeddingProfile.label,
      structuredFilters,
      fallbackUniqueHadith: fallbackUnique?.hadithId ?? null,
      narratorDetailName: narratorDetailName ?? null,
      narratedByName: narratedByName ?? null,
      bookNumber: bookNumber ?? null,
      subchainPair: subchainPair ?? null,
    });

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
      contextOnly ||
      contextualFallback ||
      (useRouter ? Boolean(routerDecision?.useContext && contextHadithId && !hasExplicitReference) : contextualFallback);
    const shouldForceHadith = Boolean(shouldUseContext || hasExplicitHadithSignal || explicitHadithId);
    const shouldAllowHadithIntent = Boolean(shouldUseContext || hasExplicitHadithSignal);
    const narratorAggregateSignal = isNarratorAggregateQuestion(question) && !narratorDetailName;
    const forceVariantsIntent =
      !comparisonSignal.wantsCompare && VARIANT_KEYWORDS.some((keyword) => question.toLowerCase().includes(keyword));
    const forceChainIntent =
      !comparisonSignal.wantsCompare && CHAIN_KEYWORDS.some((keyword) => question.toLowerCase().includes(keyword));
    const intentOverride = narratorAggregateSignal
      ? "narrator-aggregate"
      : forceVariantsIntent
        ? "variants"
        : forceChainIntent
          ? "chain"
          : intentType;
    const effectiveIntentType =
      intentOverride === "hadith" && !shouldAllowHadithIntent ? "semantic" : intentOverride;

    if (wantsFullIsnadMatn) {
      if (explicitHadithIdOutsideContext) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      if (hasUnscopedNumber && !contextOnly && !fallbackUnique) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "hadith-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_SOURCE_MESSAGE, citations: [] });
      }
      let hadithId = shouldUseContext ? contextHadithId : undefined;
      if (!hadithId && resolvedSourceNumber?.hadithId) {
        hadithId = resolvedSourceNumber.hadithId;
      }
      if (!hadithId && fallbackUnique?.hadithId) {
        hadithId = fallbackUnique.hadithId;
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
      const label = formatHadithLabel(hadith);
      const chainText = formatChainText(hadith);
      const response = `Here is ${label} with matn and isnad:\nMatn: ${hadith.matn}\nChain: ${chainText}`;
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

    if (wantsNarratorIntersection) {
      if (contextOnly && contextHadithIds.length < 2) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const resolvedPairs = parsedSourceNumbers.length
        ? await Promise.all(parsedSourceNumbers.map((match) => resolveSourceNumberMatch(match)))
        : [];
      const resolvedIds = resolvedPairs
        .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair))
        .map((pair) => pair.hadithId);
      const fallbackIds = comparisonNumbers.length
        ? await Promise.all(comparisonNumbers.map((value) => findUniqueHadithIdByNumber(value)))
        : [];
      const fallbackUniqueIds = fallbackIds
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map((row) => row.hadithId);
      const candidateIds = contextOnly
        ? contextHadithIds
        : resolvedIds.length
          ? resolvedIds
          : fallbackUniqueIds;
      const uniqueIds = Array.from(new Set(candidateIds));
      if (uniqueIds.length < 2) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_COMPARE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "intersection-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_COMPARE_SOURCE_MESSAGE, citations: [] });
      }
      const narrators = await findNarratorIntersectionForHadiths(uniqueIds.slice(0, 3));
      const response = narrators.length
        ? `Narrators appearing in all selected chains: ${narrators.map((n) => n.name).join(", ")}.`
        : "I did not find any narrators shared across those hadith chains.";
      await logRagInteraction({
        question,
        filters,
        retrievedIds: uniqueIds,
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
    }

    if (wantsChainCount) {
      if (hasUnscopedNumber && !contextOnly && !fallbackUnique) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "chaincount-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_SOURCE_MESSAGE, citations: [] });
      }
      let hadithId = shouldUseContext ? contextHadithId : undefined;
      if (!hadithId && resolvedSourceNumber?.hadithId) {
        hadithId = resolvedSourceNumber.hadithId;
      }
      if (!hadithId && fallbackUnique?.hadithId) {
        hadithId = fallbackUnique.hadithId;
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
      const chain = hadith.chain;
      const prophetIndex = chain.findIndex((node) => node.type === "prophet" || node.name.toLowerCase().includes("prophet"));
      const bukhariIndex = chain.findIndex((node) => node.name.toLowerCase().includes("bukhari"));
      let count = 0;
      let note = "";
      if (prophetIndex <= 0) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [hadithId],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      if (bukhariIndex >= 0 && prophetIndex > bukhariIndex) {
        count = prophetIndex - bukhariIndex - 1;
      } else {
        count = prophetIndex - 1;
        note = " I do not see Imam al-Bukhari explicitly in the stored chain, so this counts between the first narrator and the Prophet.";
      }
      const response = `There are ${count} narrators between Imam al-Bukhari and the Prophet in ${formatHadithLabel(hadith)}.${note}`;
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

    if (wantsSubchain && subchainPair) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const sourceId = sourceMatch?.id ?? null;
      const firstMatches = await findNarratorsByName(subchainPair.first);
      const secondMatches = await findNarratorsByName(subchainPair.second);
      const firstIds = firstMatches.map((match) => match.id);
      const secondIds = secondMatches.map((match) => match.id);
      if (!firstIds.length || !secondIds.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_NARRATOR_MESSAGE,
          citations: [],
        });
        return NextResponse.json({ answer: REQUIRE_NARRATOR_MESSAGE, citations: [] });
      }
      const ids = await findHadithIdsByNarratorPair({
        firstNarratorIds: firstIds,
        secondNarratorIds: secondIds,
        sourceId,
        limit: 20,
      });
      if (!ids.length) {
        const response = `I could not find a chain containing "${subchainPair.first} → ${subchainPair.second}".`;
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response,
          citations: [],
        });
        return NextResponse.json({ answer: response, citations: [] });
      }
      const hadiths = await getHadithByIds(ids);
      const citations = hadiths.map((hadith) => buildCitation(hadith));
      const response = formatListAnswer(hadiths, sourceMatch?.name ?? null);
      await logRagInteraction({
        question,
        filters,
        retrievedIds: ids,
        response,
        citations,
      });
      return NextResponse.json({ answer: response, citations });
    }

    if (narratedByName) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const narratorLimit = listSignal.all ? MAX_LIST_RESULTS : listSignal.count ?? limit ?? 10;
      const ids = await findHadithIdsByNarratorName({
        name: narratedByName,
        sourceId: sourceMatch?.id ?? null,
        limit: narratorLimit,
      });
      if (!ids.length) {
        const response = `I could not find hadiths narrated by ${narratedByName} in the data I have.`;
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response,
          citations: [],
        });
        return NextResponse.json({ answer: response, citations: [] });
      }
      const hadiths = await getHadithByIds(ids);
      const citations = hadiths.map((hadith) => buildCitation(hadith));
      const response = formatListAnswer(hadiths, sourceMatch?.name ?? null, {
        limit: listSignal.all ? narratorLimit : undefined,
        requestedAll: listSignal.all,
      });
      await logRagInteraction({
        question,
        filters,
        retrievedIds: ids,
        response,
        citations,
      });
      return NextResponse.json({ answer: response, citations });
    }

    if (wantsTeachers) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const sourceId = sourceMatch?.id ?? (await findSourcesByName("Bukhari", 1))[0]?.id ?? null;
      const teachers = await fetchChainHeadNarrators({ sourceId, limit: 50 });
      if (!teachers.length) {
        const response = "I could not find teachers for Imam al-Bukhari in the stored chains.";
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response,
          citations: [],
        });
        return NextResponse.json({ answer: response, citations: [] });
      }
      const response = `Teachers of Imam al-Bukhari in this dataset: ${teachers
        .map((n) => n.name)
        .join(", ")}.`;
      await logRagInteraction({
        question,
        filters,
        retrievedIds: teachers.map((t) => t.id),
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
    }

    if (wantsTabi) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const narrators = await fetchNarratorsByTier({
        sourceId: sourceMatch?.id ?? null,
        tierQuery: "Tābiʿī",
        excludeQuery: "Atbāʿ",
        limit: 50,
      });
      if (!narrators.length) {
        const response = "I could not find Tabi'i narrators in the stored chains.";
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response,
          citations: [],
        });
        return NextResponse.json({ answer: response, citations: [] });
      }
      const response = `Tabi'i narrators in ${sourceMatch?.name ?? "the collection"}: ${narrators
        .map((n) => n.name)
        .join(", ")}.`;
      await logRagInteraction({
        question,
        filters,
        retrievedIds: narrators.map((n) => n.id),
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
    }

    if (wantsUniqueChains) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const top = await fetchTopNarratorsByUniqueChains({ sourceId: sourceMatch?.id ?? null, limit: 1 });
      if (!top.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const response = `Narrator with the most unique chains: ${top[0].name} (${top[0].count} chains).`;
      await logRagInteraction({
        question,
        filters,
        retrievedIds: [top[0].id],
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
    }

    if (wantsSingleOccurrence) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const narrators = await fetchNarratorsWithSingleOccurrence({ sourceId: sourceMatch?.id ?? null, limit: 20 });
      const response = narrators.length
        ? `Narrators appearing only once in ${sourceMatch?.name ?? "the collection"}: ${narrators
            .map((n) => n.name)
            .join(", ")}.`
        : `I did not find single-occurrence narrators in ${sourceMatch?.name ?? "the collection"}.`;
      await logRagInteraction({
        question,
        filters,
        retrievedIds: narrators.map((n) => n.id),
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
    }

    if (wantsUniqueNarratorCount) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const count = await countUniqueNarrators({ sourceId: sourceMatch?.id ?? null });
      const response = `Total unique narrators in ${sourceMatch?.name ?? "the collection"}: ${count}.`;
      await logRagInteraction({
        question,
        filters,
        retrievedIds: [],
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
    }

    if (wantsNarratorsMostAssociated) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const topic = extractTopicQuery(question) ?? extractTopicTerms(question).join(" ");
      if (!topic) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: "Please specify a topic to associate narrators with.",
          citations: [],
        });
        return NextResponse.json({ answer: "Please specify a topic to associate narrators with.", citations: [] });
      }
      const hadithIds = await searchHadithIdsByQuery({
        text: topic,
        filters: sourceMatch?.name ? { source: sourceMatch.name } : undefined,
        limit: 50,
      });
      const narrators = await fetchTopNarratorsByHadithIds(hadithIds, 10);
      const response = narrators.length
        ? `Narrators most associated with hadiths about ${topic}: ${narrators
            .map((n, index) => `${index + 1}. ${n.name} (${n.count})`)
            .join("; ")}.`
        : SAFE_FALLBACK;
      await logRagInteraction({
        question,
        filters,
        retrievedIds: narrators.map((n) => n.id),
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
    }

    if (wantsSameMatnDifferentChains) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const ids = await fetchHadithIdsWithSameMatnDifferentChains({ sourceId: sourceMatch?.id ?? null, limit: 5 });
      if (ids.length) {
        const groups = await fetchMatnGroupsForHadithIds(ids);
        const hadiths = await getHadithByIds(ids);
        const map = new Map(hadiths.map((hadith) => [Number(hadith.id), hadith]));
        const sections = groups
          .filter((group) => (group.chainIds ?? []).length > 1)
          .map((group, index) => {
            const labels = group.hadithIds
              .map((id) => map.get(id))
              .filter(Boolean)
              .map((hadith) => formatHadithLabel(hadith!));
            return `Group ${index + 1}: ${labels.join(", ")}`;
          })
          .filter(Boolean);
        if (sections.length) {
          const response = `Hadiths sharing the same matn but different chains:\n${sections.join("\n")}`;
          await logRagInteraction({
            question,
            filters,
            retrievedIds: ids,
            response,
            citations: hadiths.map((hadith) => buildCitation(hadith)),
          });
          return NextResponse.json({ answer: response, citations: hadiths.map((hadith) => buildCitation(hadith)) });
        }
      }

      const pairsByPrefix = await findMatnPairsByPrefix(2);
      if (!pairsByPrefix.length) {
        const response = "I do not see any hadiths sharing the same matn with different chains in the stored data.";
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response,
          citations: [],
        });
        return NextResponse.json({ answer: response, citations: [] });
      }
      const pairIds = Array.from(new Set(pairsByPrefix.flat()));
      const hadithPairs = await loadHadithInsights(pairIds);
      const pairMap = new Map(hadithPairs.map((hadith) => [Number(hadith.id), hadith]));
      const pairs = pairsByPrefix
        .map(([aId, bId]) => {
          const a = pairMap.get(aId);
          const b = pairMap.get(bId);
          if (!a || !b) return null;
          if (!compareChains(a, b).different) return null;
          return { a, b };
        })
        .filter((pair): pair is { a: HadithInsight; b: HadithInsight } => Boolean(pair));
      if (!pairs.length) {
        const response = "I do not see any hadiths sharing the same matn with different chains in the stored data.";
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response,
          citations: [],
        });
        return NextResponse.json({ answer: response, citations: [] });
      }
      const response = formatComparisonPairs(pairs, "of near-identical matn with different chains");
      const citations = pairs.flatMap((pair) => [buildCitation(pair.a), buildCitation(pair.b)]);
      await logRagInteraction({
        question,
        filters,
        retrievedIds: pairs.flatMap((pair) => [Number(pair.a.id), Number(pair.b.id)]),
        response,
        citations,
      });
      return NextResponse.json({ answer: response, citations });
    }

    if (wantsMultipleChains || wantsTransmissionPaths) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      let topic = extractTopicQuery(question);
      const fallbackTerms = extractTopicTerms(question);
      if (!topic && fallbackTerms.length) {
        topic = fallbackTerms.join(" ");
      }
      if (!topic) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: "Please specify a topic to analyze chains for.",
          citations: [],
        });
        return NextResponse.json({ answer: "Please specify a topic to analyze chains for.", citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      let hadithIds = await searchHadithIdsByQuery({
        text: topic,
        filters: sourceMatch?.name ? { source: sourceMatch.name } : undefined,
        limit: 20,
      });
      if (!hadithIds.length && fallbackTerms.length) {
        const fallbackText = fallbackTerms.join(" ");
        hadithIds = await searchHadithIdsByQuery({
          text: fallbackText,
          filters: sourceMatch?.name ? { source: sourceMatch.name } : undefined,
          limit: 20,
        });
        if (hadithIds.length) {
          topic = fallbackText;
        }
      }
      if (!hadithIds.length) {
        const listTerms = fallbackTerms.length ? fallbackTerms : topic.split(" ").filter(Boolean);
        if (listTerms.length) {
          hadithIds = await fetchListHadithIdsWithTopic(sourceMatch?.id ?? null, 20, listTerms);
          if (hadithIds.length) {
            topic = listTerms.join(" ");
          }
        }
      }
      const groups = await fetchMatnGroupsForHadithIds(hadithIds, wantsTransmissionPaths ? 1 : 2);
      if (!groups.length) {
        const response = wantsMultipleChains
          ? `I only see one chain for the hadith about ${topic} in the stored data.`
          : SAFE_FALLBACK;
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response,
          citations: [],
        });
        return NextResponse.json({ answer: response, citations: [] });
      }
      const targetGroup =
        groups.find((group) => (group.chainIds ?? []).length > 1 || group.hadithIds.length > 1) ?? groups[0];
      const hadiths = await getHadithByIds(targetGroup.hadithIds);
      if (wantsMultipleChains && hadiths.length <= 1) {
        const response = `I only see one chain for the hadith about ${topic} in the stored data.`;
        await logRagInteraction({
          question,
          filters,
          retrievedIds: hadiths.map((h) => Number(h.id)),
          response,
          citations: hadiths.map((hadith) => buildCitation(hadith)),
        });
        return NextResponse.json({ answer: response, citations: hadiths.map((hadith) => buildCitation(hadith)) });
      }
      const lines = hadiths.map((hadith, index) => {
        return `${index + 1}. ${formatHadithLabel(hadith)} — Chain: ${formatChainText(hadith)}`;
      });
      const response = `Unique transmission paths for the hadith about ${topic}:\n${lines.join("\n")}`;
      await logRagInteraction({
        question,
        filters,
        retrievedIds: hadiths.map((h) => Number(h.id)),
        response,
        citations: hadiths.map((hadith) => buildCitation(hadith)),
      });
      return NextResponse.json({
        answer: response,
        citations: hadiths.map((hadith) => buildCitation(hadith)),
      });
    }

    if (wantsKnowledgeChain) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const sourceMatch = await resolveSourceMatch(question);
      const hadithIds = await searchHadithIdsByQuery({
        text: "knowledge is taken away",
        filters: sourceMatch?.name ? { source: sourceMatch.name } : undefined,
        limit: 5,
      });
      if (!hadithIds.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }
      const hadiths = await getHadithByIds(hadithIds);
      const primary = hadiths[0];
      const response = `Here is the hadith about knowledge being taken away:\nMatn: ${primary.matn}\nChain: ${formatChainText(
        primary,
      )}`;
      const citations = [buildCitation(primary)];
      await logRagInteraction({
        question,
        filters,
        retrievedIds: [Number(primary.id)],
        response,
        citations,
      });
      return NextResponse.json({ answer: response, citations });
    }

    if (comparisonSignal.wantsCompare) {
      const buildPairsWithDifferentChains = (hadiths: HadithInsight[], limit: number) => {
        const pairs: Array<{ a: HadithInsight; b: HadithInsight }> = [];
        for (let i = 0; i < hadiths.length; i += 1) {
          for (let j = i + 1; j < hadiths.length; j += 1) {
            const a = hadiths[i];
            const b = hadiths[j];
            if (!a || !b) continue;
            const diff = compareChains(a, b);
            if (!diff.different) continue;
            pairs.push({ a, b });
            if (pairs.length >= limit) return pairs;
          }
        }
        return pairs;
      };

      const resolvedComparePairs = parsedSourceNumbers.length
        ? await Promise.all(parsedSourceNumbers.map((match) => resolveSourceNumberMatch(match)))
        : [];
      const resolvedCompareIds = Array.from(
        new Set(
          resolvedComparePairs
            .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair))
            .map((pair) => pair.hadithId),
        ),
      );
      const resolvedCompareFallback = comparisonNumbers.length
        ? await Promise.all(
            comparisonNumbers.map((value) => findUniqueHadithIdByNumber(value)),
          )
        : [];
      const resolvedCompareFallbackIds = Array.from(
        new Set(
          resolvedCompareFallback
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
            .map((row) => row.hadithId),
        ),
      );

      let pairs: Array<{ a: HadithInsight; b: HadithInsight }> = [];
      if (contextOnly) {
        const scopedIds = contextHadithIds;
        if (scopedIds.length >= 2) {
          const hadiths = await loadHadithInsights(scopedIds);
          pairs = buildPairsWithDifferentChains(hadiths, comparisonSignal.count);
        } else {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: CONTEXT_ONLY_MESSAGE,
            citations: [],
            retrievalMode: "context-only",
          });
          return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
        }
      } else if (resolvedCompareIds.length >= 2) {
        const ids = resolvedCompareIds.slice(0, comparisonSignal.count * 2);
        const hadiths = await loadHadithInsights(ids);
        pairs = buildPairsWithDifferentChains(hadiths, comparisonSignal.count);
      } else if (resolvedCompareFallbackIds.length >= 2) {
        const ids = resolvedCompareFallbackIds.slice(0, comparisonSignal.count * 2);
        const hadiths = await loadHadithInsights(ids);
        pairs = buildPairsWithDifferentChains(hadiths, comparisonSignal.count);
      } else if (comparisonNumbers.length >= 2) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_COMPARE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "compare-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_COMPARE_SOURCE_MESSAGE, citations: [] });
      } else if (comparisonSignal.hadithIds.length >= 2) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_COMPARE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "compare-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_COMPARE_SOURCE_MESSAGE, citations: [] });
      } else if (comparisonSignal.matnQuery) {
        const matches = await findHadithIdsByMatnSimilarity(
          comparisonSignal.matnQuery,
          Math.max(6, comparisonSignal.count * 3),
          MATN_SIMILARITY_THRESHOLD,
        );
        const ids = matches.map((match) => match.id);
        const hadiths = await loadHadithInsights(ids);
        pairs = buildPairsWithDifferentChains(hadiths, comparisonSignal.count);
      } else {
        const pairsByPrefix = await findMatnPairsByPrefix(Math.max(1, comparisonSignal.count));
        const ids = Array.from(new Set(pairsByPrefix.flat()));
        const hadiths = await loadHadithInsights(ids);
        const map = new Map(hadiths.map((hadith) => [Number(hadith.id), hadith]));
        pairs = pairsByPrefix
          .map(([aId, bId]) => {
            const a = map.get(aId);
            const b = map.get(bId);
            if (!a || !b) return null;
            if (!compareChains(a, b).different) return null;
            return { a, b };
          })
          .filter((pair): pair is { a: HadithInsight; b: HadithInsight } => Boolean(pair));
      }

      if (!pairs.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: SAFE_FALLBACK,
          citations: [],
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }

      const ids = pairs.flatMap((pair) => [Number(pair.a.id), Number(pair.b.id)]);
      const citations = pairs.flatMap((pair) => [buildCitation(pair.a), buildCitation(pair.b)]);
      const isSimilarityDriven =
        Boolean(comparisonSignal.matnQuery) ||
        (!contextOnly &&
          !resolvedCompareIds.length &&
          !resolvedCompareFallbackIds.length &&
          !comparisonNumbers.length &&
          !comparisonSignal.hadithIds.length &&
          !parsedSourceNumbers.length);
      const comparisonDescriptor = isSimilarityDriven
        ? "of near-identical matn with different chains"
        : "comparing matn and chains";
      const response = formatComparisonPairs(pairs, comparisonDescriptor);
      await logRagInteraction({
        question,
        filters,
        retrievedIds: ids,
        response,
        citations,
      });
      return NextResponse.json({ answer: response, citations });
    }

    if (attributeIntent.wantsAttribute) {
      if (contextOnly && explicitHadithId && !contextSet.has(explicitHadithId)) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "attribute-context",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      if (hasUnscopedNumber && !contextOnly && !fallbackUnique) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "attribute-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_SOURCE_MESSAGE, citations: [] });
      }

      let ids: number[] = [];
      if (contextOnly) {
        ids = contextHadithIds.slice(0, Math.min(contextHadithIds.length, Math.max(1, limit ?? 5)));
      } else if (explicitHadithId) {
        ids = [explicitHadithId];
      } else if (resolvedSourceNumber?.hadithId) {
        ids = [resolvedSourceNumber.hadithId];
      } else if (fallbackUnique?.hadithId) {
        ids = [fallbackUnique.hadithId];
      } else {
        const candidates = await searchHadithIdsByQuery({
          text: question,
          filters: structuredFilters,
          limit: 5,
        });
        if (candidates.length === 1) {
          ids = candidates;
        } else if (candidates.length > 1) {
          const options = await getHadithByIds(candidates);
          const response = formatHadithOptions(options, "that description");
          await logRagInteraction({
            question,
            filters,
            retrievedIds: candidates,
            response,
            citations: [],
            retrievalMode: "attribute-select",
          });
          return NextResponse.json({ answer: response, citations: [] });
        }
      }

      if (!ids.length) {
        const response = contextOnly ? REQUIRE_CONTEXT_MESSAGE : REQUIRE_ID_MESSAGE;
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response,
          citations: [],
          retrievalMode: "attribute-missing",
        });
        return NextResponse.json({ answer: response, citations: [] });
      }

      const hadiths = await getHadithByIds(ids);
      if (!hadiths.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: ids,
          response: SAFE_FALLBACK,
          citations: [],
          retrievalMode: "attribute-empty",
        });
        return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
      }

      const response = formatAttributeAnswer(hadiths, attributeIntent);
      const citations = hadiths.map((hadith) => buildCitation(hadith));
      logRagDebug("attribute", { ids, intent: attributeIntent, contextOnly });
      await logRagInteraction({
        question,
        filters,
        retrievedIds: ids,
        response,
        citations,
        retrievalMode: contextOnly ? "attribute-context" : "attribute-direct",
      });
      return NextResponse.json({ answer: response, citations });
    }

    const shouldHandleList =
      ((effectiveIntentType === "list" && useRouter) || listSignal.wantsList) &&
      !comparisonSignal.wantsCompare &&
      !attributeIntent.wantsAttribute;
    if (shouldHandleList && (!shouldForceHadith || contextOnly)) {
      const requestedCount = listSignal.all
        ? MAX_LIST_RESULTS
        : clampCount(routerDecision?.count ?? listSignal.count ?? limit ?? 5, limit ?? 5);
      if (contextOnly) {
        const ids = contextHadithIds.slice(0, requestedCount);
        const hadiths = await getHadithByIds(ids);
        if (!hadiths.length) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: SAFE_FALLBACK,
            citations: [],
            retrievalMode: "context-list",
          });
          return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
        }
        const citations = hadiths.map((hadith) => buildCitation(hadith));
        const response = formatListAnswer(hadiths, "the selected context", {
          limit: listSignal.all ? requestedCount : undefined,
          requestedAll: listSignal.all,
        });
        await logRagInteraction({
          question,
          filters,
          retrievedIds: ids,
          response,
          citations,
          retrievalMode: "context-list",
        });
        return NextResponse.json({
          answer: response,
          citations,
          retrieved: ids.map((id) => ({ hadithId: id })),
        });
      }
      const sourceQuery = routerDecision?.source ?? extractSourceQueryFromQuestion(question);
      let sourceMatch: { id: number; name: string } | null = null;
      if (sourceQuery) {
        const sources = await findSourcesByName(sourceQuery, 1);
        sourceMatch = sources[0] ?? null;
        if (!sourceMatch) {
          const mentioned = await findSourcesMentionedInQuestion(question, 1);
          sourceMatch = mentioned[0] ?? null;
        }
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
      const sourceId = sourceMatch?.id ?? filters.sourceId ?? null;
      let bookIds = filters.bookId ? [filters.bookId] : null;
      let chapterIds = filters.chapterId ? [filters.chapterId] : null;

      let bookQuery = structuredFilters.book ?? extractBookQueryFromQuestion(question);
      if (!bookIds && bookNumber && !bookQuery) {
        const matches = await findBooksByNumber(bookNumber, sourceId ?? undefined, 10);
        if (!matches.length) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: BOOK_NOT_FOUND,
            citations: [],
          });
          return NextResponse.json({ answer: BOOK_NOT_FOUND, citations: [] });
        }
        bookIds = matches.map((match) => match.id);
        if (matches.length === 1) {
          bookQuery = matches[0].name;
        }
      }

      if (!bookIds && bookQuery) {
        const matches = await findBooksByName(bookQuery, 10);
        const scoped = sourceId ? matches.filter((match) => match.sourceId === sourceId) : matches;
        if (!scoped.length) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: BOOK_NOT_FOUND,
            citations: [],
          });
          return NextResponse.json({ answer: BOOK_NOT_FOUND, citations: [] });
        }
        bookIds = scoped.map((match) => match.id);
      }

      const chapterQuery = structuredFilters.chapter ?? extractChapterQueryFromQuestion(question);
      if (!chapterIds && chapterQuery) {
        const matches = await findChaptersByName(chapterQuery, 10);
        const scopedByBook = bookIds
          ? matches.filter((match) => match.bookId && bookIds?.includes(match.bookId))
          : matches;
        const scoped = sourceId ? scopedByBook.filter((match) => match.sourceId === sourceId) : scopedByBook;
        if (!scoped.length) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: CHAPTER_NOT_FOUND,
            citations: [],
          });
          return NextResponse.json({ answer: CHAPTER_NOT_FOUND, citations: [] });
        }
        chapterIds = scoped.map((match) => match.id);
      }
      const topicQuery = extractTopicQuery(question);
      const topicTerms = topicQuery ? [] : extractTopicTerms(question);
      const useIdFilteredListing = Boolean((bookIds?.length || chapterIds?.length) && !bookQuery);
      const listFilters = {
        ...structuredFilters,
        ...(bookQuery ? { book: bookQuery } : {}),
        ...(chapterQuery ? { chapter: chapterQuery } : {}),
        ...(sourceMatch?.name ? { source: sourceMatch.name } : sourceQuery ? { source: sourceQuery } : {}),
      };
      let ids: number[] = [];
      if (topicQuery) {
        if (!useIdFilteredListing) {
          ids = await searchHadithIdsByQuery({
            text: topicQuery,
            filters: listFilters,
            limit: requestedCount,
          });
        }
        if (!ids.length) {
          ids = await fetchListHadithIdsWithTopic(
            sourceId,
            requestedCount,
            [topicQuery],
            bookIds,
            chapterIds,
          );
        }
      } else if (topicTerms.length) {
        if (!useIdFilteredListing) {
          ids = await searchHadithIdsByQuery({
            text: topicTerms.join(" "),
            filters: listFilters,
            limit: requestedCount,
          });
        }
        if (!ids.length) {
          ids = await fetchListHadithIdsWithTopic(
            sourceId,
            requestedCount,
            topicTerms,
            bookIds,
            chapterIds,
          );
        }
      } else {
        ids = await fetchListHadithIds(sourceId, requestedCount, bookIds, chapterIds);
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
      const response = formatListAnswer(hadiths, sourceMatch?.name ?? sourceQuery, {
        limit: listSignal.all ? requestedCount : undefined,
        requestedAll: listSignal.all,
      });
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

    if (effectiveIntentType === "narrator-aggregate" && !narratorDetailName) {
      if (contextOnly) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const requestedCount = clampCount(
        routerDecision?.count ?? extractTopCount(question) ?? limit ?? 5,
        5,
      );
      let sourceId = filters.sourceId ?? null;
      let sourceLabel: string | null = null;
      const sourceQuery = routerDecision?.source ?? extractSourceQueryFromQuestion(question);

      let bookIds = filters.bookId ? [filters.bookId] : null;
      let chapterIds = filters.chapterId ? [filters.chapterId] : null;
      let bookLabel: string | null = null;
      let chapterLabel: string | null = null;

      const bookQuery = structuredFilters.book ?? extractBookQueryFromQuestion(question);
      if (!bookIds) {
        if (bookQuery) {
          const matches = await findBooksByName(bookQuery, 10);
          const scoped = sourceId ? matches.filter((match) => match.sourceId === sourceId) : matches;
          if (!scoped.length) {
            await logRagInteraction({
              question,
              filters,
              retrievedIds: [],
              response: BOOK_NOT_FOUND,
              citations: [],
            });
            return NextResponse.json({ answer: BOOK_NOT_FOUND, citations: [] });
          }
          bookIds = scoped.map((match) => match.id);
          bookLabel = scoped.length === 1 ? scoped[0].name : `book "${bookQuery}"`;
          if (!sourceLabel && scoped.length === 1 && scoped[0].sourceName) {
            sourceLabel = scoped[0].sourceName;
          }
        }
      }

      if (!sourceId && sourceQuery) {
        const sources = await findSourcesByName(sourceQuery, 1);
        const match = sources[0] ?? null;
        if (!match) {
          if (!bookQuery) {
            const bookMatches = await findBooksByName(sourceQuery, 10);
            if (bookMatches.length) {
              bookIds = bookIds ?? bookMatches.map((row) => row.id);
              bookLabel = bookLabel ?? (bookMatches.length === 1 ? bookMatches[0].name : `book "${sourceQuery}"`);
              sourceLabel = sourceLabel ?? bookMatches[0].sourceName ?? null;
            } else {
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
        } else {
          sourceId = match.id;
          sourceLabel = match.name;
        }
      }

      if (!chapterIds) {
        const chapterQuery = structuredFilters.chapter ?? extractChapterQueryFromQuestion(question);
        if (chapterQuery) {
          const matches = await findChaptersByName(chapterQuery, 10);
          const scoped = sourceId ? matches.filter((match) => match.sourceId === sourceId) : matches;
          if (!scoped.length) {
            await logRagInteraction({
              question,
              filters,
              retrievedIds: [],
              response: CHAPTER_NOT_FOUND,
              citations: [],
            });
            return NextResponse.json({ answer: CHAPTER_NOT_FOUND, citations: [] });
          }
          chapterIds = scoped.map((match) => match.id);
          chapterLabel = scoped.length === 1 ? scoped[0].name : `chapter "${chapterQuery}"`;
          if (!sourceLabel && scoped.length === 1 && scoped[0].sourceName) {
            sourceLabel = scoped[0].sourceName;
          }
        }
      }

      const results = await fetchTopNarrators({
        sourceId,
        bookIds,
        chapterIds,
        limit: requestedCount,
      });
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

      const scopeParts: string[] = [];
      if (chapterLabel) {
        scopeParts.push(`chapter ${chapterLabel}`);
      } else if (bookLabel) {
        scopeParts.push(`book ${bookLabel}`);
      } else {
        scopeParts.push("the collection");
      }
      if (sourceLabel) {
        scopeParts.push(`in ${sourceLabel}`);
      }
      const scopeLabel = scopeParts.join(" ");
      const list = results.map((row, index) => `${index + 1}. ${row.name} (${row.count})`).join("; ");
      const response = `Top narrators in ${scopeLabel}: ${list}.`;
      await logRagInteraction({
        question,
        filters,
        retrievedIds: results.map((row) => row.id),
        response,
        citations: [],
      });
      return NextResponse.json({ answer: response, citations: [] });
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
      const scopedIds = contextOnly ? resolvedIds.filter((id) => contextSet.has(id)) : resolvedIds;
      if (contextOnly && resolvedIds.length && !scopedIds.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      if (scopedIds.length) {
        const baseResults = await retrieveHadithByIds(scopedIds);
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
      if (explicitHadithIdOutsideContext) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      if (hasUnscopedNumber && !contextOnly && !fallbackUnique) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "chain-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_SOURCE_MESSAGE, citations: [] });
      }
      let hadithId = shouldUseContext ? contextHadithId : undefined;
      if (!hadithId && resolvedSourceNumber?.hadithId) {
        hadithId = resolvedSourceNumber.hadithId;
      }
      if (!hadithId && fallbackUnique?.hadithId) {
        hadithId = fallbackUnique.hadithId;
      }
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
      if (explicitHadithIdOutsideContext) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      if (hasUnscopedNumber && !contextOnly && !fallbackUnique) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "variants-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_SOURCE_MESSAGE, citations: [] });
      }
      let hadithId = shouldUseContext ? contextHadithId : undefined;
      if (!hadithId && resolvedSourceNumber?.hadithId) {
        hadithId = resolvedSourceNumber.hadithId;
      }
      if (!hadithId && fallbackUnique?.hadithId) {
        hadithId = fallbackUnique.hadithId;
      }
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
      const variantIds = variantsResult.variants.map((variant) => variant.hadithId);
      const variantHadiths = variantIds.length ? await getHadithByIds(variantIds) : [];
      const variantMap = new Map(variantHadiths.map((variant) => [Number(variant.id), variant]));
      const response = formatVariantsAnswer(hadith, variantsResult.variants, variantMap);
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
      let detail: Awaited<ReturnType<typeof getNarratorDetailsById>> | null = null;
      if (contextOnly) {
        if (!contextHadithId) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: CONTEXT_ONLY_MESSAGE,
            citations: [],
            retrievalMode: "context-only",
          });
          return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
        }
        const matches = await findNarratorsByNameInHadith(narratorDetailName, contextHadithId);
        if (matches.length > 1) {
          const options = matches.map((match) => `${match.name} (ID ${match.id})`).join(", ");
          const response = `I found multiple narrators matching "${narratorDetailName}" in this hadith: ${options}. Please specify the narrator id.`;
          await logRagInteraction({
            question,
            filters,
            retrievedIds: matches.map((match) => match.id),
            response,
            citations: [],
            retrievalMode: "context-only",
          });
          return NextResponse.json({ answer: response, citations: [] });
        }
        if (matches.length === 1) {
          detail = await getNarratorDetailsById(matches[0].id);
        }
        if (!detail) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: CONTEXT_ONLY_MESSAGE,
            citations: [],
            retrievalMode: "context-only",
          });
          return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
        }
      } else {
        detail = await getNarratorDetailsByName(narratorDetailName);
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
      if (contextOnly && (intentNarratorId || intentNarratorName)) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
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
      if (explicitHadithIdOutsideContext) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      if (hasUnscopedNumber && !contextOnly && !fallbackUnique) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: REQUIRE_SOURCE_MESSAGE,
          citations: [],
          retrievalMode: "hadith-missing-source",
        });
        return NextResponse.json({ answer: REQUIRE_SOURCE_MESSAGE, citations: [] });
      }
      if (contextOnly && !hasExplicitHadithSignal && !requestedHadithNumber && !hasSourceNumber) {
        const baseResults = await retrieveHadithByIds(contextHadithIds);
        if (!baseResults.length) {
          await logRagInteraction({
            question,
            filters,
            retrievedIds: [],
            response: SAFE_FALLBACK,
            citations: [],
            retrievalMode: "context-only",
          });
          return NextResponse.json({ answer: SAFE_FALLBACK, citations: [] });
        }
        const detailIds = buildContextDetailIds(baseResults, contextHadithIds, MAX_CONTEXT_DETAILS);
        const hadithDetails = await getHadithByIds(detailIds);
        const hadithMap = new Map(hadithDetails.map((item) => [Number(item.id), item]));
        const graphMap = await loadGraphContext(detailIds, MAX_GRAPH_CONTEXT);
        const context = buildRagContext(baseResults, hadithMap, graphMap);
        const answer = await generateRagAnswer({ question, results: baseResults, context });
        const graph = await buildAnswerGraph(answer.citations);
        await logRagInteraction({
          question,
          filters,
          retrievedIds: baseResults.map((r) => r.hadithId),
          modelUsed: answer.modelUsed,
          promptTokens: answer.usage?.promptTokens,
          completionTokens: answer.usage?.completionTokens,
          totalTokens: answer.usage?.totalTokens,
          response: answer.answer,
          citations: answer.citations,
          retrievalMode: "context-only",
        });
        return NextResponse.json({
          answer: answer.answer,
          citations: answer.citations,
          graph,
          retrieved: baseResults,
        });
      }
      let resolvedHadithId: number | undefined;
      if (hasSourceNumber) {
        resolvedHadithId = resolvedSourceNumber?.hadithId;
      }
      if (!resolvedHadithId) {
        resolvedHadithId = shouldUseContext ? contextHadithId! : fallbackUnique?.hadithId;
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
          const options = sources.map((source) => source.name).join(", ");
          const response = `I found multiple sources matching "${parsedSourceNumber.sourceQuery}": ${options}. Please specify the source name.`;
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

    if (contextOnly) {
      const contextResults = await retrieveHadithByIds(contextHadithIds);
      if (!contextResults.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: [],
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const detailIds = buildContextDetailIds(contextResults, contextHadithIds, MAX_CONTEXT_DETAILS);
      const hadithDetails = await getHadithByIds(detailIds);
      const hadithMap = new Map(hadithDetails.map((item) => [Number(item.id), item]));
      const graphMap = await loadGraphContext(detailIds, MAX_GRAPH_CONTEXT);
      const context = buildRagContext(contextResults, hadithMap, graphMap);
      const answer = await generateRagAnswer({ question, results: contextResults, context });
      if (!answer.citations.length) {
        await logRagInteraction({
          question,
          filters,
          retrievedIds: contextResults.map((r) => r.hadithId),
          response: CONTEXT_ONLY_MESSAGE,
          citations: [],
          retrievalMode: "context-only",
        });
        return NextResponse.json({ answer: CONTEXT_ONLY_MESSAGE, citations: [] });
      }
      const graph = await buildAnswerGraph(answer.citations);
      await logRagInteraction({
        question,
        filters,
        retrievedIds: contextResults.map((r) => r.hadithId),
        modelUsed: answer.modelUsed,
        promptTokens: answer.usage?.promptTokens,
        completionTokens: answer.usage?.completionTokens,
        totalTokens: answer.usage?.totalTokens,
        response: answer.answer,
        citations: answer.citations,
        retrievalMode: "context-only",
      });
      return NextResponse.json({
        answer: answer.answer,
        citations: answer.citations,
        graph,
        retrieved: contextResults,
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

    let activeProfile = embeddingProfile;
    let hybridResults = await retrieveHadithForQuestionHybrid({
      question,
      limit,
      model: activeProfile.providerModel,
      storageModel: activeProfile.storageModel,
      kgModel: DEFAULT_EMBEDDING_PROFILE.providerModel,
      kgStorageModel: DEFAULT_EMBEDDING_PROFILE.storageModel,
      filters,
      includeProvenance: true,
      seedHadithIds: seedIds,
    });
    let retrievalMode = activeProfile.label === "augmented" ? "hybrid-augmented" : "hybrid";
    let results =
      hybridResults.results.length > 0
        ? hybridResults.results
        : await retrieveHadithForQuestion({
            question,
            ...filters,
            limit,
            model: activeProfile.providerModel,
            storageModel: activeProfile.storageModel,
          });
    if (hybridResults.results.length === 0 && results.length > 0) {
      retrievalMode = activeProfile.label === "augmented" ? "pg-augmented" : "pg";
    }

    if (!results.length && activeProfile.label === "augmented") {
      const fallbackProfile = DEFAULT_EMBEDDING_PROFILE;
      const fallbackHybrid = await retrieveHadithForQuestionHybrid({
        question,
        limit,
        model: fallbackProfile.providerModel,
        storageModel: fallbackProfile.storageModel,
        kgModel: DEFAULT_EMBEDDING_PROFILE.providerModel,
        kgStorageModel: DEFAULT_EMBEDDING_PROFILE.storageModel,
        filters,
        includeProvenance: true,
        seedHadithIds: seedIds,
      });
      let fallbackMode = "hybrid-fallback";
      let fallbackResults =
        fallbackHybrid.results.length > 0
          ? fallbackHybrid.results
          : await retrieveHadithForQuestion({
              question,
              ...filters,
              limit,
              model: fallbackProfile.providerModel,
              storageModel: fallbackProfile.storageModel,
            });
      if (fallbackHybrid.results.length === 0 && fallbackResults.length > 0) {
        fallbackMode = "pg-fallback";
      }
      if (fallbackResults.length) {
        activeProfile = fallbackProfile;
        hybridResults = fallbackHybrid;
        results = fallbackResults;
        retrievalMode = fallbackMode;
      }
    }

    logRagDebug("retrieval", {
      mode: retrievalMode,
      resultCount: results.length,
      seedCount: seedIds.length,
      embeddingProfile: activeProfile.label,
    });

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
