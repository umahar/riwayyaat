import { embedTextsDirect, DEFAULT_EMBEDDING_MODEL } from "@/server/rag/embeddings";
import { getSession } from "@/server/graph/client";
import { ensureVectorIndex, getVectorIndexName } from "@/server/graph/indexes";
import { RagFilters, RagResult } from "@/types/rag";
import { retrieveHadithByIds } from "@/server/rag/retriever";
import { getClient } from "@/server/db/client";

type KgRetrievalParams = {
  question: string;
  limit?: number;
  model?: string;
  filters?: RagFilters;
};

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

function reorderByIds(results: RagResult[], orderedIds: number[]) {
  const map = new Map(results.map((result) => [result.hadithId, result]));
  return orderedIds.map((id) => map.get(id)).filter(Boolean) as RagResult[];
}

export async function retrieveHadithForQuestionKg(params: KgRetrievalParams): Promise<RagResult[]> {
  const question = params.question.trim();
  if (!question) return [];
  const model = params.model || process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 20) : 8;

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
    const orderedIds = result.records
      .map((record) => Number(record.get("hadithId")))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (!orderedIds.length) return [];

    const results = await retrieveHadithByIds(orderedIds);
    const ordered = reorderByIds(results, orderedIds);
    return await applyFilters(ordered, params.filters);
  } catch (error) {
    console.warn("[rag] KG retrieval failed, falling back", error);
    return [];
  } finally {
    await session.close();
  }
}
