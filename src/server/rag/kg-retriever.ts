import { embedTextsDirect, DEFAULT_EMBEDDING_MODEL } from "@/server/rag/embeddings";
import { getSession } from "@/server/graph/client";
import { ensureVectorIndex, getVectorIndexName } from "@/server/graph/indexes";
import { RagFilters, RagGraph, RagResult } from "@/types/rag";
import { retrieveHadithByIds, retrieveHadithForQuestion } from "@/server/rag/retriever";
import { retrieveHadithForQuestionLexical } from "@/server/rag/lexical";
import { getClient } from "@/server/db/client";
import { resolveSourceNumberQuestion } from "@/server/rag/source-number";

type KgRetrievalParams = {
  question: string;
  limit?: number;
  model?: string;
  filters?: RagFilters;
  includeProvenance?: boolean;
  seedHadithIds?: number[];
};

type KgRetrievalOutput = {
  results: RagResult[];
  provenance?: RagGraph | null;
};

type GraphSignals = {
  sharedNarrators: number;
  sharedBooks: number;
  sharedSources: number;
  sharedChapters: number;
  sharedTags: number;
  sharedGrades: number;
  sharedScholars: number;
  sharedChainTypes: number;
  sharedNarrationLevels: number;
  sharedAttributionTypes: number;
  sharedTransmissionMethods: number;
};

type VectorHit = {
  hadithId: number;
  score: number;
};

const GRAPH_SIGNAL_DEFAULTS: GraphSignals = {
  sharedNarrators: 0,
  sharedBooks: 0,
  sharedSources: 0,
  sharedChapters: 0,
  sharedTags: 0,
  sharedGrades: 0,
  sharedScholars: 0,
  sharedChainTypes: 0,
  sharedNarrationLevels: 0,
  sharedAttributionTypes: 0,
  sharedTransmissionMethods: 0,
};

const DEFAULT_GRAPH_WEIGHTS = {
  narrator: 0.6,
  book: 0.2,
  source: 0.15,
  chapter: 0.05,
  tag: 0.12,
  grade: 0.1,
  scholar: 0.08,
  chainType: 0.08,
  narrationLevel: 0.06,
  attributionType: 0.06,
  transmissionMethod: 0.05,
};

const DEFAULT_KG_WEIGHTS = {
  vector: 0.55,
  graph: 0.45,
};

const DEFAULT_HYBRID_WEIGHTS = {
  vector: 0.5,
  graph: 0.25,
  dense: 0.2,
  lexical: 0.05,
};

const VECTOR_CANDIDATE_MULTIPLIER = 4;
const GRAPH_CANDIDATE_LIMIT = 40;
const SEED_LIMIT = 8;
const PROVENANCE_LIMIT = 6;
const PROVENANCE_PATH_LIMIT = 80;

const clampScore = (value: number) => Math.max(0, Math.min(1, value));

const parseWeight = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeWeights = <T extends Record<string, number>>(weights: T): T => {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return weights;
  const normalized = Object.entries(weights).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = value / total;
    return acc;
  }, {});
  return normalized as T;
};

function getGraphWeights() {
  return normalizeWeights({
    narrator: parseWeight(process.env.RAG_GRAPH_WEIGHT_NARRATOR, DEFAULT_GRAPH_WEIGHTS.narrator),
    book: parseWeight(process.env.RAG_GRAPH_WEIGHT_BOOK, DEFAULT_GRAPH_WEIGHTS.book),
    source: parseWeight(process.env.RAG_GRAPH_WEIGHT_SOURCE, DEFAULT_GRAPH_WEIGHTS.source),
    chapter: parseWeight(process.env.RAG_GRAPH_WEIGHT_CHAPTER, DEFAULT_GRAPH_WEIGHTS.chapter),
    tag: parseWeight(process.env.RAG_GRAPH_WEIGHT_TAG, DEFAULT_GRAPH_WEIGHTS.tag),
    grade: parseWeight(process.env.RAG_GRAPH_WEIGHT_GRADE, DEFAULT_GRAPH_WEIGHTS.grade),
    scholar: parseWeight(process.env.RAG_GRAPH_WEIGHT_SCHOLAR, DEFAULT_GRAPH_WEIGHTS.scholar),
    chainType: parseWeight(process.env.RAG_GRAPH_WEIGHT_CHAIN_TYPE, DEFAULT_GRAPH_WEIGHTS.chainType),
    narrationLevel: parseWeight(
      process.env.RAG_GRAPH_WEIGHT_NARRATION_LEVEL,
      DEFAULT_GRAPH_WEIGHTS.narrationLevel,
    ),
    attributionType: parseWeight(
      process.env.RAG_GRAPH_WEIGHT_ATTRIBUTION_TYPE,
      DEFAULT_GRAPH_WEIGHTS.attributionType,
    ),
    transmissionMethod: parseWeight(
      process.env.RAG_GRAPH_WEIGHT_TRANSMISSION_METHOD,
      DEFAULT_GRAPH_WEIGHTS.transmissionMethod,
    ),
  });
}

function getKgWeights() {
  return normalizeWeights({
    vector: parseWeight(process.env.RAG_KG_VECTOR_WEIGHT, DEFAULT_KG_WEIGHTS.vector),
    graph: parseWeight(process.env.RAG_KG_GRAPH_WEIGHT, DEFAULT_KG_WEIGHTS.graph),
  });
}

function getHybridWeights() {
  return normalizeWeights({
    vector: parseWeight(process.env.RAG_HYBRID_VECTOR_WEIGHT, DEFAULT_HYBRID_WEIGHTS.vector),
    graph: parseWeight(process.env.RAG_HYBRID_GRAPH_WEIGHT, DEFAULT_HYBRID_WEIGHTS.graph),
    dense: parseWeight(process.env.RAG_HYBRID_DENSE_WEIGHT, DEFAULT_HYBRID_WEIGHTS.dense),
    lexical: parseWeight(process.env.RAG_HYBRID_LEXICAL_WEIGHT, DEFAULT_HYBRID_WEIGHTS.lexical),
  });
}

async function resolveTagNames(tagIds: number[]) {
  const ids = tagIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return new Set<string>();
  const client = await getClient();
  try {
    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM tag WHERE id = ANY($1::int[])",
      [ids],
    );
    return new Set(rows.map((row) => row.name.toLowerCase()));
  } finally {
    client.release();
  }
}

async function applyFilters(results: RagResult[], filters?: RagFilters) {
  if (!filters) return results;
  const tagNames =
    filters.tagIds && filters.tagIds.length ? await resolveTagNames(filters.tagIds) : new Set<string>();
  return results.filter((result) => {
    if (filters.sourceId && result.source.id !== filters.sourceId) return false;
    if (filters.bookId && result.book?.id !== filters.bookId) return false;
    if (filters.chapterId && result.chapter?.id !== filters.chapterId) return false;
    if (tagNames.size) {
      const tags = new Set(result.tags.map((tag) => tag.toLowerCase()));
      if (![...tagNames].some((tag) => tags.has(tag))) return false;
    }
    if (filters.gradeIds && filters.gradeIds.length) {
      const grades = new Set(result.grades.map((grade) => grade.grade.id));
      if (!filters.gradeIds.some((id) => id && grades.has(id))) return false;
    }
    if (filters.scholarIds && filters.scholarIds.length) {
      const scholars = new Set(result.grades.map((grade) => grade.scholar.id));
      if (!filters.scholarIds.some((id) => id && scholars.has(id))) return false;
    }
    return true;
  });
}

async function fetchVectorHits(question: string, model: string, limit: number): Promise<VectorHit[]> {
  if (!question.trim()) return [];
  await ensureVectorIndex();
  const vector = await embedTextsDirect([question], model);
  const session = getSession({ defaultAccessMode: "READ" });
  try {
    const result = await session.run(
      `
        CALL db.index.vector.queryNodes($index, $k, $vector)
        YIELD node, score
        WHERE node.embeddingModel = $model
        RETURN node.pgId AS hadithId, score
        ORDER BY score DESC
      `,
      {
        index: getVectorIndexName(),
        k: limit,
        vector: vector[0],
        model,
      },
    );
    return result.records
      .map((record) => ({
        hadithId: Number(record.get("hadithId")),
        score: Number(record.get("score")),
      }))
      .filter((row) => Number.isFinite(row.hadithId) && row.hadithId > 0)
      .map((row) => ({ ...row, score: clampScore(row.score) }));
  } finally {
    await session.close();
  }
}

async function fetchGraphSignals(seedIds: number[]): Promise<Map<number, GraphSignals>> {
  const signals = new Map<number, GraphSignals>();
  if (!seedIds.length) return signals;
  const session = getSession({ defaultAccessMode: "READ" });

  const updateSignal = (hadithId: number, key: keyof GraphSignals, value: number) => {
    if (!Number.isFinite(hadithId) || hadithId <= 0) return;
    const current = signals.get(hadithId) ?? { ...GRAPH_SIGNAL_DEFAULTS };
    current[key] += value;
    signals.set(hadithId, current);
  };

  const runCount = async (cypher: string, key: keyof GraphSignals) => {
    const result = await session.run(cypher, { seedIds });
    result.records.forEach((record) => {
      const hadithId = Number(record.get("hadithId"));
      const count = Number(record.get("count"));
      if (Number.isFinite(count) && count > 0) updateSignal(hadithId, key, count);
    });
  };

  try {
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:HAS_CHAIN]->(:Chain)-[:STEP]->(n:Narrator)<-[:STEP]-(:Chain)<-[:HAS_CHAIN]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT n) AS count
      `,
      "sharedNarrators",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:IN_BOOK]->(b:Book)<-[:IN_BOOK]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT b) AS count
      `,
      "sharedBooks",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:FROM_SOURCE]->(s:Source)<-[:FROM_SOURCE]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT s) AS count
      `,
      "sharedSources",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:IN_CHAPTER]->(c:Chapter)<-[:IN_CHAPTER]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT c) AS count
      `,
      "sharedChapters",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:TAGGED]->(t:Tag)<-[:TAGGED]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT t) AS count
      `,
      "sharedTags",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:GRADED]->(g:Grade)<-[:GRADED]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT g) AS count
      `,
      "sharedGrades",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:GRADED]->(:Grade)-[:BY]->(s:Scholar)<-[:BY]-(:Grade)<-[:GRADED]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT s) AS count
      `,
      "sharedScholars",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:HAS_CHAIN]->(:Chain)-[:CHAIN_TYPE]->(ct:ChainType)<-[:CHAIN_TYPE]-(:Chain)<-[:HAS_CHAIN]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT ct) AS count
      `,
      "sharedChainTypes",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:HAS_CHAIN]->(:Chain)-[:NARRATION_LEVEL]->(nl:NarrationLevel)<-[:NARRATION_LEVEL]-(:Chain)<-[:HAS_CHAIN]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT nl) AS count
      `,
      "sharedNarrationLevels",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:HAS_CHAIN]->(:Chain)-[:ATTRIBUTION_TYPE]->(at:AttributionType)<-[:ATTRIBUTION_TYPE]-(:Chain)<-[:HAS_CHAIN]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT at) AS count
      `,
      "sharedAttributionTypes",
    );
    await runCount(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (seed)-[:HAS_CHAIN]->(:Chain)-[:STEP]->(n:Narrator)-[:HAS_METHOD]->(tm:TransmissionMethod)<-[:HAS_METHOD]-(:Narrator)<-[:STEP]-(:Chain)<-[:HAS_CHAIN]-(candidate:Hadith)
        WHERE candidate.pgId <> seed.pgId
        RETURN candidate.pgId AS hadithId, count(DISTINCT tm) AS count
      `,
      "sharedTransmissionMethods",
    );
  } finally {
    await session.close();
  }

  return signals;
}

function computeGraphScores(signals: Map<number, GraphSignals>): Map<number, number> {
  if (!signals.size) return new Map();
  const weights = getGraphWeights();
  let maxNarrators = 0;
  let maxBooks = 0;
  let maxSources = 0;
  let maxChapters = 0;
  let maxTags = 0;
  let maxGrades = 0;
  let maxScholars = 0;
  let maxChainTypes = 0;
  let maxNarrationLevels = 0;
  let maxAttributionTypes = 0;
  let maxTransmissionMethods = 0;

  signals.forEach((signal) => {
    maxNarrators = Math.max(maxNarrators, signal.sharedNarrators);
    maxBooks = Math.max(maxBooks, signal.sharedBooks);
    maxSources = Math.max(maxSources, signal.sharedSources);
    maxChapters = Math.max(maxChapters, signal.sharedChapters);
    maxTags = Math.max(maxTags, signal.sharedTags);
    maxGrades = Math.max(maxGrades, signal.sharedGrades);
    maxScholars = Math.max(maxScholars, signal.sharedScholars);
    maxChainTypes = Math.max(maxChainTypes, signal.sharedChainTypes);
    maxNarrationLevels = Math.max(maxNarrationLevels, signal.sharedNarrationLevels);
    maxAttributionTypes = Math.max(maxAttributionTypes, signal.sharedAttributionTypes);
    maxTransmissionMethods = Math.max(maxTransmissionMethods, signal.sharedTransmissionMethods);
  });

  const scores = new Map<number, number>();
  signals.forEach((signal, hadithId) => {
    const narratorScore = maxNarrators ? signal.sharedNarrators / maxNarrators : 0;
    const bookScore = maxBooks ? signal.sharedBooks / maxBooks : 0;
    const sourceScore = maxSources ? signal.sharedSources / maxSources : 0;
    const chapterScore = maxChapters ? signal.sharedChapters / maxChapters : 0;
    const tagScore = maxTags ? signal.sharedTags / maxTags : 0;
    const gradeScore = maxGrades ? signal.sharedGrades / maxGrades : 0;
    const scholarScore = maxScholars ? signal.sharedScholars / maxScholars : 0;
    const chainTypeScore = maxChainTypes ? signal.sharedChainTypes / maxChainTypes : 0;
    const narrationLevelScore = maxNarrationLevels ? signal.sharedNarrationLevels / maxNarrationLevels : 0;
    const attributionTypeScore = maxAttributionTypes ? signal.sharedAttributionTypes / maxAttributionTypes : 0;
    const transmissionMethodScore = maxTransmissionMethods ? signal.sharedTransmissionMethods / maxTransmissionMethods : 0;
    const total =
      narratorScore * weights.narrator +
      bookScore * weights.book +
      sourceScore * weights.source +
      chapterScore * weights.chapter +
      tagScore * weights.tag +
      gradeScore * weights.grade +
      scholarScore * weights.scholar +
      chainTypeScore * weights.chainType +
      narrationLevelScore * weights.narrationLevel +
      attributionTypeScore * weights.attributionType +
      transmissionMethodScore * weights.transmissionMethod;
    scores.set(hadithId, clampScore(total));
  });
  return scores;
}

function mergeScores(params: {
  results: RagResult[];
  vectorScores: Map<number, number>;
  graphScores: Map<number, number>;
  denseScores?: Map<number, number>;
  lexicalScores?: Map<number, number>;
  weights: { vector: number; graph: number; dense?: number; lexical?: number };
}) {
  const { vectorScores, graphScores, denseScores, lexicalScores, weights } = params;
  params.results.forEach((result) => {
    const vectorScore = vectorScores.get(result.hadithId) ?? 0;
    const graphScore = graphScores.get(result.hadithId) ?? 0;
    const denseScore = denseScores?.get(result.hadithId) ?? 0;
    const lexicalScore = lexicalScores?.get(result.hadithId) ?? 0;
    const combined = clampScore(
      vectorScore * weights.vector +
        graphScore * weights.graph +
        denseScore * (weights.dense ?? 0) +
        lexicalScore * (weights.lexical ?? 0),
    );
    result.similarity = combined;
    result.retrieval = {
      vectorScore,
      graphScore,
      denseScore: weights.dense != null ? denseScore : undefined,
      lexicalScore: weights.lexical != null ? lexicalScore : undefined,
      combinedScore: combined,
    };
  });
}

function sortByScore(results: RagResult[]) {
  return [...results].sort((a, b) => {
    const diff = (b.similarity ?? 0) - (a.similarity ?? 0);
    if (diff !== 0) return diff;
    return a.hadithId - b.hadithId;
  });
}

async function fetchProvenanceGraph(
  seedIds: number[],
  candidateIds: number[],
): Promise<RagGraph | null> {
  if (!seedIds.length || !candidateIds.length) return null;
  const session = getSession({ defaultAccessMode: "READ" });
  try {
    const result = await session.run(
      `
        MATCH (seed:Hadith)
        WHERE seed.pgId IN $seedIds
        MATCH (candidate:Hadith)
        WHERE candidate.pgId IN $candidateIds
        OPTIONAL MATCH p1=(seed)-[:HAS_CHAIN]->(:Chain)-[:STEP]->(:Narrator)<-[:STEP]-(:Chain)<-[:HAS_CHAIN]-(candidate)
        OPTIONAL MATCH p2=(seed)-[:IN_BOOK]->(:Book)<-[:IN_BOOK]-(candidate)
        OPTIONAL MATCH p3=(seed)-[:FROM_SOURCE]->(:Source)<-[:FROM_SOURCE]-(candidate)
        OPTIONAL MATCH p4=(seed)-[:IN_CHAPTER]->(:Chapter)<-[:IN_CHAPTER]-(candidate)
        WITH collect(p1) + collect(p2) + collect(p3) + collect(p4) AS paths
        UNWIND paths AS p
        WITH p WHERE p IS NOT NULL
        WITH collect(DISTINCT p) AS uniquePaths
        UNWIND uniquePaths AS p
        WITH p LIMIT $maxPaths
        UNWIND nodes(p) AS node
        UNWIND relationships(p) AS rel
        RETURN collect(DISTINCT node) AS nodes, collect(DISTINCT rel) AS rels
      `,
      { seedIds, candidateIds, maxPaths: PROVENANCE_PATH_LIMIT },
    );

    if (!result.records.length) return null;
    const record = result.records[0];
    const nodes = (record.get("nodes") as any[]) ?? [];
    const rels = (record.get("rels") as any[]) ?? [];
    if (!nodes.length || !rels.length) return null;

    const nodesMap = new Map<string, { id: string; label: string; type: string; provenance: boolean }>();
    const edgesMap = new Map<string, { id: string; from: string; to: string; type: string; provenance: boolean }>();

    const addNode = (node: any) => {
      const label = node.labels?.[0] ?? "Node";
      const id = node.properties?.key || `${label}:${node.properties?.pgId ?? node.identity?.toString()}`;
      const display =
        node.properties?.name ||
        node.properties?.title ||
        node.properties?.identifier ||
        node.properties?.displayLabel ||
        node.properties?.label ||
        `${label} ${node.properties?.pgId ?? ""}`.trim();
      if (!nodesMap.has(id)) {
        nodesMap.set(id, { id, label: display, type: label, provenance: true });
      }
    };

    const addEdge = (rel: any) => {
      const type = rel.type ?? "REL";
      const from = rel.start?.properties?.key || rel.start?.identity?.toString();
      const to = rel.end?.properties?.key || rel.end?.identity?.toString();
      if (!from || !to) return;
      const id = rel.identity ? rel.identity.toString() : `${from}->${to}:${type}`;
      if (!edgesMap.has(id)) {
        edgesMap.set(id, { id, from, to, type, provenance: true });
      }
    };

    nodes.forEach(addNode);
    rels.forEach(addEdge);

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    };
  } finally {
    await session.close();
  }
}

export async function retrieveHadithForQuestionKg(params: KgRetrievalParams): Promise<KgRetrievalOutput> {
  const question = params.question.trim();
  if (!question) return { results: [] };
  const model = params.model || process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 20) : 8;
  const vectorLimit = Math.min(50, limit * VECTOR_CANDIDATE_MULTIPLIER);

  try {
    const directMatch = await resolveSourceNumberQuestion(question);
    const vectorHits = await fetchVectorHits(question, model, vectorLimit);
    const seedFromParams = (params.seedHadithIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
    const vectorScores = new Map(vectorHits.map((hit) => [hit.hadithId, hit.score]));
    if (directMatch) {
      vectorScores.set(directMatch.hadithId, 1);
    }
    const seedIds = Array.from(
      new Set([
        ...vectorHits.slice(0, Math.min(SEED_LIMIT, vectorHits.length)).map((hit) => hit.hadithId),
        ...(directMatch ? [directMatch.hadithId] : []),
        ...seedFromParams,
      ]),
    );

    if (!seedIds.length) return { results: [] };

    const graphSignals = await fetchGraphSignals(seedIds);
    const graphScores = computeGraphScores(graphSignals);

    const graphCandidateIds = Array.from(graphScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, GRAPH_CANDIDATE_LIMIT)
      .map(([id]) => id);

    const candidateIds = Array.from(new Set([...vectorScores.keys(), ...graphCandidateIds, ...seedIds]));
    if (!candidateIds.length) return { results: [] };

    const results = await retrieveHadithByIds(candidateIds);
    if (!results.length) return { results: [] };

    const weights = getKgWeights();
    mergeScores({ results, vectorScores, graphScores, weights });

    const scored = sortByScore(results);
    const filtered = await applyFilters(scored, params.filters);
    const finalResults = filtered.slice(0, limit);

    let provenance: RagGraph | null = null;
    if (params.includeProvenance) {
      const provenanceIds = finalResults
        .slice(0, Math.min(PROVENANCE_LIMIT, finalResults.length))
        .map((r) => r.hadithId);
      provenance = await fetchProvenanceGraph(seedIds, provenanceIds);
    }

    return { results: finalResults, provenance };
  } catch (error) {
    console.warn("[rag] KG retrieval failed, falling back", error);
    return { results: [] };
  }
}

export async function retrieveHadithForQuestionHybrid(params: KgRetrievalParams): Promise<KgRetrievalOutput> {
  const question = params.question.trim();
  if (!question) return { results: [] };
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 20) : 8;

  const kgLimit = Math.min(40, Math.max(limit * 3, 12));
  const denseLimit = Math.min(40, Math.max(limit * 3, 12));
  const lexicalLimit = Math.min(40, Math.max(limit * 3, 12));

  const kg = await retrieveHadithForQuestionKg({
    ...params,
    limit: kgLimit,
    includeProvenance: params.includeProvenance,
  });

  const dense = await retrieveHadithForQuestion({
    question,
    limit: denseLimit,
    ...params.filters,
    model: params.model,
  });

  const lexical = await retrieveHadithForQuestionLexical({
    question,
    limit: lexicalLimit,
    filters: params.filters,
  });

  const denseScores = new Map(dense.map((row) => [row.hadithId, clampScore(row.similarity)]));
  const merged = new Map<number, RagResult>();

  kg.results.forEach((row) => {
    merged.set(row.hadithId, { ...row });
  });

  dense.forEach((row) => {
    if (!merged.has(row.hadithId)) {
      merged.set(row.hadithId, { ...row, similarity: 0 });
    }
  });

  const lexicalIds = lexical.map((row) => row.hadithId);
  const missingLexicalIds = lexicalIds.filter((id) => !merged.has(id));
  if (missingLexicalIds.length) {
    const lexicalRows = await retrieveHadithByIds(missingLexicalIds);
    lexicalRows.forEach((row) => {
      merged.set(row.hadithId, { ...row, similarity: 0 });
    });
  }

  const results = Array.from(merged.values());
  const vectorScores = new Map(
    results.map((row) => [row.hadithId, row.retrieval?.vectorScore ?? 0]),
  );
  const graphScores = new Map(
    results.map((row) => [row.hadithId, row.retrieval?.graphScore ?? 0]),
  );
  const lexicalScores = new Map(lexical.map((row) => [row.hadithId, clampScore(row.score)]));

  const weights = getHybridWeights();
  mergeScores({ results, vectorScores, graphScores, denseScores, lexicalScores, weights });

  const sorted = sortByScore(results);
  const filtered = await applyFilters(sorted, params.filters);

  return { results: filtered.slice(0, limit), provenance: kg.provenance ?? null };
}
