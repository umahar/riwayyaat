import { getClient } from "@/server/db/client";

export type SourceMatch = {
  id: number;
  name: string;
  aliases?: string[] | null;
};

export type BookMatch = {
  id: number;
  name: string;
  sourceId: number | null;
  sourceName: string | null;
};

export type ChapterMatch = {
  id: number;
  name: string;
  bookId: number | null;
  bookName: string | null;
  sourceId: number | null;
  sourceName: string | null;
};

export async function findSourcesByName(name: string, limit = 5): Promise<SourceMatch[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<SourceMatch>(
      `
        SELECT s.id, s.name, array_remove(array_agg(sa.alias), NULL) AS aliases
        FROM source s
        LEFT JOIN source_alias sa ON sa.source_id = s.id
        WHERE s.name ILIKE $1 OR sa.alias ILIKE $1
        GROUP BY s.id, s.name
        ORDER BY length(s.name), s.name
        LIMIT $2
      `,
      [`%${name}%`, Math.max(1, Math.min(limit, 10))],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function findBooksByName(name: string, limit = 5): Promise<BookMatch[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<BookMatch>(
      `
        SELECT b.id, b.name, b.source_id AS "sourceId", s.name AS "sourceName"
        FROM book b
        LEFT JOIN source s ON s.id = b.source_id
        WHERE b.name ILIKE $1
        ORDER BY length(b.name), b.name
        LIMIT $2
      `,
      [`%${name}%`, Math.max(1, Math.min(limit, 10))],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function findChaptersByName(name: string, limit = 5): Promise<ChapterMatch[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<ChapterMatch>(
      `
        SELECT
          c.id,
          c.name,
          c.book_id AS "bookId",
          b.name AS "bookName",
          s.id AS "sourceId",
          s.name AS "sourceName"
        FROM chapter c
        LEFT JOIN book b ON b.id = c.book_id
        LEFT JOIN source s ON s.id = b.source_id
        WHERE c.name ILIKE $1
        ORDER BY length(c.name), c.name
        LIMIT $2
      `,
      [`%${name}%`, Math.max(1, Math.min(limit, 10))],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function findSourcesMentionedInQuestion(
  question: string,
  limit = 6,
): Promise<SourceMatch[]> {
  if (!question.trim()) return [];
  const normalizedQuestion = question
    .normalize("NFKD")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"");
  const client = await getClient();
  try {
    const { rows } = await client.query<SourceMatch>(
      `
        SELECT s.id, s.name, array_remove(array_agg(sa.alias), NULL) AS aliases
        FROM source s
        LEFT JOIN source_alias sa ON sa.source_id = s.id
        WHERE $1 ILIKE '%' || s.name || '%'
           OR $1 ILIKE '%' || sa.alias || '%'
        GROUP BY s.id, s.name
        ORDER BY length(s.name) DESC, s.name
        LIMIT $2
      `,
      [normalizedQuestion, Math.max(1, Math.min(limit, 20))],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function findHadithIdBySourceAndNumber(sourceId: number, number: number): Promise<number | null> {
  const client = await getClient();
  try {
    const { rows } = await client.query<{ id: number }>(
      `
        SELECT id
        FROM hadith
        WHERE source_id = $1
          AND (number = $2 OR display_number = $3)
          AND deleted_at IS NULL
        ORDER BY id
        LIMIT 1
      `,
      [sourceId, number, String(number)],
    );
    return rows[0]?.id ?? null;
  } finally {
    client.release();
  }
}
