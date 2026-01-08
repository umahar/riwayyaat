import { getClient } from "@/server/db/client";

export type MatnGroup = {
  matnId: number;
  hadithIds: number[];
  chainIds: number[];
};

export async function fetchMatnGroupsForHadithIds(
  hadithIds: number[],
  minHadiths = 2,
): Promise<MatnGroup[]> {
  const unique = Array.from(new Set(hadithIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (!unique.length) return [];
  const client = await getClient();
  try {
    const { rows } = await client.query<{
      matn_id: number;
      hadith_ids: number[];
      chain_ids: number[];
    }>(
      `
        SELECT
          h.matn_id,
          array_agg(DISTINCT h.id ORDER BY h.id) AS hadith_ids,
          array_remove(array_agg(DISTINCT hc.id), NULL) AS chain_ids
        FROM hadith h
        LEFT JOIN hadith_chain hc ON hc.hadith_id = h.id
        WHERE h.id = ANY($1::int[])
        GROUP BY h.matn_id
        HAVING COUNT(DISTINCT h.id) >= $2
      `,
      [unique, Math.max(1, minHadiths)],
    );
    return rows.map((row) => ({
      matnId: row.matn_id,
      hadithIds: row.hadith_ids ?? [],
      chainIds: row.chain_ids ?? [],
    }));
  } finally {
    client.release();
  }
}

export async function fetchHadithIdsWithSameMatnDifferentChains(params: {
  sourceId?: number | null;
  limit?: number;
}): Promise<number[]> {
  const client = await getClient();
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 20) : 10;
  try {
    const { rows } = await client.query<{ hadith_ids: number[] }>(
      `
        WITH grouped AS (
          SELECT
            h.matn_id,
            array_agg(DISTINCT h.id ORDER BY h.id) AS hadith_ids,
            COUNT(DISTINCT hc.id) AS chain_count
          FROM hadith h
          LEFT JOIN hadith_chain hc ON hc.hadith_id = h.id
          WHERE h.deleted_at IS NULL
            AND ($1::int IS NULL OR h.source_id = $1)
          GROUP BY h.matn_id
          HAVING COUNT(DISTINCT h.id) > 1 AND COUNT(DISTINCT hc.id) > 1
          ORDER BY COUNT(DISTINCT h.id) DESC, h.matn_id
          LIMIT $2
        )
        SELECT hadith_ids FROM grouped
      `,
      [params.sourceId ?? null, limit],
    );
    return rows.flatMap((row) => row.hadith_ids ?? []);
  } finally {
    client.release();
  }
}
