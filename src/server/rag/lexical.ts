import { getClient } from "@/server/db/client";
import type { RagFilters } from "@/types/rag";

export type LexicalResult = {
  hadithId: number;
  score: number;
};

const MIN_QUERY_LENGTH = 3;

function buildFilterClauses(filters: RagFilters | undefined, paramOffset: number) {
  const clauses: string[] = ["h.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (!filters) return { clauses, params };
  if (filters.sourceId) {
    params.push(filters.sourceId);
    clauses.push(`h.source_id = $${paramOffset + params.length - 1}`);
  }
  if (filters.bookId) {
    params.push(filters.bookId);
    clauses.push(`h.book_id = $${paramOffset + params.length - 1}`);
  }
  if (filters.chapterId) {
    params.push(filters.chapterId);
    clauses.push(`h.chapter_id = $${paramOffset + params.length - 1}`);
  }
  if (filters.tagIds && filters.tagIds.length) {
    params.push(filters.tagIds);
    clauses.push(
      `EXISTS (
         SELECT 1
         FROM hadith_tag ht
         WHERE ht.hadith_id = h.id
           AND ht.tag_id = ANY($${paramOffset + params.length - 1})
       )`,
    );
  }
  if (filters.gradeIds && filters.gradeIds.length) {
    params.push(filters.gradeIds);
    clauses.push(
      `EXISTS (
         SELECT 1
         FROM hadith_grade hg
         WHERE hg.hadith_id = h.id
           AND hg.grade_id = ANY($${paramOffset + params.length - 1})
       )`,
    );
  }
  if (filters.scholarIds && filters.scholarIds.length) {
    params.push(filters.scholarIds);
    clauses.push(
      `EXISTS (
         SELECT 1
         FROM hadith_grade hg
         WHERE hg.hadith_id = h.id
           AND hg.scholar_id = ANY($${paramOffset + params.length - 1})
       )`,
    );
  }

  return { clauses, params };
}

function normalizeScores(rows: LexicalResult[]) {
  if (!rows.length) return rows;
  const max = Math.max(...rows.map((row) => row.score));
  if (max <= 0) return rows.map((row) => ({ ...row, score: 0 }));
  return rows.map((row) => ({ ...row, score: Math.min(1, Math.max(0, row.score / max)) }));
}

export async function retrieveHadithForQuestionLexical(params: {
  question: string;
  limit?: number;
  filters?: RagFilters;
}): Promise<LexicalResult[]> {
  const question = params.question.trim();
  if (!question || question.length < MIN_QUERY_LENGTH) return [];
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 50) : 20;

  const { clauses, params: filterParams } = buildFilterClauses(params.filters, 3);
  const client = await getClient();
  try {
    const sql = `
      WITH q AS (
        SELECT websearch_to_tsquery('english', $1) AS query
      )
      SELECT
        h.id,
        (
          COALESCE(MAX(ts_rank_cd(m.matn_search, q.query)), 0) * 0.6 +
          COALESCE(MAX(ts_rank_cd(s.source_search, q.query)), 0) * 0.1 +
          COALESCE(MAX(ts_rank_cd(b.book_search, q.query)), 0) * 0.1 +
          COALESCE(MAX(ts_rank_cd(c.chapter_search, q.query)), 0) * 0.05 +
          COALESCE(MAX(ts_rank_cd(n.narrator_search, q.query)), 0) * 0.08 +
          COALESCE(MAX(ts_rank_cd(t.tag_search, q.query)), 0) * 0.04 +
          COALESCE(MAX(ts_rank_cd(g.grade_search, q.query)), 0) * 0.02 +
          COALESCE(MAX(ts_rank_cd(sc.scholar_search, q.query)), 0) * 0.01
        ) AS score
      FROM hadith h
      JOIN matn m ON m.id = h.matn_id
      JOIN source s ON s.id = h.source_id
      LEFT JOIN book b ON b.id = h.book_id
      LEFT JOIN chapter c ON c.id = h.chapter_id
      LEFT JOIN hadith_chain hc ON hc.hadith_id = h.id
      LEFT JOIN chain_narrator cn ON cn.chain_id = hc.id
      LEFT JOIN narrator n ON n.id = cn.narrator_id
      LEFT JOIN hadith_tag ht ON ht.hadith_id = h.id
      LEFT JOIN tag t ON t.id = ht.tag_id
      LEFT JOIN hadith_grade hg ON hg.hadith_id = h.id
      LEFT JOIN grade g ON g.id = hg.grade_id
      LEFT JOIN scholar sc ON sc.id = hg.scholar_id
      CROSS JOIN q
      WHERE ${clauses.join(" AND ")}
        AND (
          m.matn_search @@ q.query
          OR s.source_search @@ q.query
          OR b.book_search @@ q.query
          OR c.chapter_search @@ q.query
          OR n.narrator_search @@ q.query
          OR t.tag_search @@ q.query
          OR g.grade_search @@ q.query
          OR sc.scholar_search @@ q.query
        )
      GROUP BY h.id
      ORDER BY score DESC
      LIMIT $2
    `;
    const { rows } = await client.query<{ id: number; score: number }>(sql, [question, limit, ...filterParams]);
    return normalizeScores(
      rows
        .map((row) => ({ hadithId: row.id, score: Number(row.score) }))
        .filter((row) => Number.isFinite(row.hadithId) && Number.isFinite(row.score)),
    );
  } finally {
    client.release();
  }
}
