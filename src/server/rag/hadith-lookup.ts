import { getClient } from "@/server/db/client";

export type SourceMatch = {
  id: number;
  name: string;
  aliases?: string[] | null;
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
