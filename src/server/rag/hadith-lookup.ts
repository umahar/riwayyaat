import { getClient } from "@/server/db/client";

export type SourceMatch = {
  id: number;
  name: string;
};

export async function findSourcesByName(name: string, limit = 5): Promise<SourceMatch[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<SourceMatch>(
      `
        SELECT id, name
        FROM source
        WHERE name ILIKE $1
        ORDER BY length(name), name
        LIMIT $2
      `,
      [`%${name}%`, Math.max(1, Math.min(limit, 10))],
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
