// Mark server-only in Next.js; ignore when running standalone scripts (tsx/node).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop for script contexts */
}
import { embedTextsDirect, DEFAULT_EMBEDDING_MODEL } from "@/server/rag/embeddings";
import { RagFilters, RagRetrievalParams, RagResult } from "@/types/rag";
import { getClient } from "@/server/db/client";

/**
 * Retrieval strategy:
 * - Embed the user question with the same model used for hadith_embedding (defaults to EMBEDDING_MODEL or text-embedding-3-small).
 * - Vector similarity (cosine) search over hadith_embedding.embedding with optional filters (source/book/chapter/tags/grades/scholars).
 * - Exclude soft-deleted hadith (deleted_at IS NULL).
 * - Returns top-K with similarity scores and core metadata for RAG.
 */

async function embedQuestion(question: string, model: string): Promise<number[]> {
  const embeddings = await embedTextsDirect([question], model);
  return embeddings[0];
}

function buildFilters(filters: RagFilters) {
  const clauses: string[] = ["h.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (filters.sourceId) {
    params.push(filters.sourceId);
    clauses.push(`h.source_id = $${params.length}`);
  }
  if (filters.bookId) {
    params.push(filters.bookId);
    clauses.push(`h.book_id = $${params.length}`);
  }
  if (filters.chapterId) {
    params.push(filters.chapterId);
    clauses.push(`h.chapter_id = $${params.length}`);
  }
  if (filters.tagIds && filters.tagIds.length) {
    params.push(filters.tagIds);
    clauses.push(
      `EXISTS (
         SELECT 1
         FROM hadith_tag ht
         WHERE ht.hadith_id = h.id
           AND ht.tag_id = ANY($${params.length})
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
           AND hg.grade_id = ANY($${params.length})
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
           AND hg.scholar_id = ANY($${params.length})
       )`,
    );
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereClause, params };
}

export async function retrieveHadithForQuestion(params: RagRetrievalParams): Promise<RagResult[]> {
  const model = params.model || process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const limit = params.limit && params.limit > 0 ? params.limit : 8;
  if (!params.question.trim()) return [];

  const embedding = await embedQuestion(params.question, model);
  // pgvector prefers literal vector syntax; ensure bracketed string, not a PG array literal.
  const embeddingVector = `[${embedding.join(",")}]`;

  const { whereClause, params: filterParams } = buildFilters(params);
  const client = await getClient();
  try {
    const sql = `
      WITH ranked AS (
        SELECT
          h.id,
          h.display_number,
          h.display_number AS display_label,
          h.number,
          h.source_id,
          s.name AS source_name,
          h.book_id,
          b.name AS book_name,
          b.number AS book_number,
          h.chapter_id,
          c.name AS chapter_name,
          c.number AS chapter_number,
          m.text_en AS matn,
          he.embedding <=> $${filterParams.length + 1} AS distance -- cosine distance (pgvector)
        FROM hadith_embedding he
        JOIN hadith h ON h.id = he.hadith_id
        JOIN matn m ON m.id = h.matn_id
        JOIN source s ON s.id = h.source_id
        LEFT JOIN book b ON b.id = h.book_id
        LEFT JOIN chapter c ON c.id = h.chapter_id
        ${whereClause ? `${whereClause} AND` : "WHERE"} he.model = $${filterParams.length + 2}
      )
      SELECT
        r.*,
        array_remove(array_agg(DISTINCT t.name), NULL) AS tags,
        json_agg(DISTINCT jsonb_build_object(
          'grade', jsonb_build_object(
            'id', g.id,
            'title', g.name,
            'description', g.description,
            'backgroundColor', g.background_color,
            'textColor', g.text_color
          ),
          'scholar', jsonb_build_object(
            'id', sc.id,
            'name', sc.name,
            'lifespan', sc.lifespan_label
          ),
          'isPrimary', hg.is_primary
        )) FILTER (WHERE g.id IS NOT NULL) AS grades
      FROM ranked r
      LEFT JOIN hadith_tag ht ON ht.hadith_id = r.id
      LEFT JOIN tag t ON t.id = ht.tag_id
      LEFT JOIN hadith_grade hg ON hg.hadith_id = r.id
      LEFT JOIN grade g ON g.id = hg.grade_id
      LEFT JOIN scholar sc ON sc.id = hg.scholar_id
      GROUP BY r.id, r.display_number, r.display_label, r.number, r.source_id, r.source_name,
               r.book_id, r.book_name, r.book_number, r.chapter_id, r.chapter_name, r.chapter_number,
               r.matn, r.distance
      ORDER BY r.distance ASC
      LIMIT $${filterParams.length + 3}
    `;

    const { rows } = await client.query<{
      id: number;
      display_number: string | null;
      display_label: string | null;
      number: number;
      source_id: number;
      source_name: string;
      book_id: number | null;
      book_name: string | null;
      book_number: number | null;
      chapter_id: number | null;
      chapter_name: string | null;
      chapter_number: number | null;
      matn: string;
      distance: number;
      tags: string[] | null;
      grades: Array<{
        grade: { id: number; title: string; description: string | null; backgroundColor: string | null; textColor: string | null };
        scholar: { id: number; name: string; lifespan: string | null };
        isPrimary: boolean | null;
      }> | null;
    }>(sql, [...filterParams, embeddingVector, model, limit]);

    return rows.map((row) => ({
      hadithId: row.id,
      displayNumber: row.display_number,
      displayLabel: row.display_label,
      source: { id: row.source_id, name: row.source_name },
      book:
        row.book_id != null
          ? { id: row.book_id, name: row.book_name, number: row.book_number }
          : undefined,
      chapter:
        row.chapter_id != null
          ? { id: row.chapter_id, name: row.chapter_name, number: row.chapter_number }
          : undefined,
      matn: row.matn,
      tags: row.tags ?? [],
      grades: (row.grades ?? []).filter(Boolean),
      similarity: 1 - row.distance, // convert cosine distance to similarity
    }));
  } finally {
    client.release();
  }
}

/**
 * How to use (example for future API route):
 *
 * import { retrieveHadithForQuestion } from "@/server/rag/retriever";
 *
 * const results = await retrieveHadithForQuestion({
 *   question: "What is the hadith about intentions?",
 *   sourceId: 1, // optional filters
 *   limit: 5,
 * });
 */
