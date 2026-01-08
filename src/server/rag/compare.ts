import { getClient } from "@/server/db/client";
import { getHadithByIds } from "@/features/hadith/server/hadith-service";
import { HadithInsight } from "@/features/hadith/types";

export type ChainComparison = {
  chainA: string[];
  chainB: string[];
  onlyA: string[];
  onlyB: string[];
  different: boolean;
};

export type MatnSimilarityCandidate = {
  id: number;
  score: number;
};

const DEFAULT_PREFIX_LENGTH = 120;

function normalizeChainNames(chain: HadithInsight["chain"], excludeProphet = true): string[] {
  return chain
    .filter((node) => !(excludeProphet && node.type === "prophet"))
    .map((node) => node.name.trim())
    .filter(Boolean);
}

export function compareChains(
  hadithA: HadithInsight,
  hadithB: HadithInsight,
  excludeProphet = true,
): ChainComparison {
  const chainA = normalizeChainNames(hadithA.chain, excludeProphet);
  const chainB = normalizeChainNames(hadithB.chain, excludeProphet);
  const setA = new Set(chainA);
  const setB = new Set(chainB);
  const onlyA = chainA.filter((name) => !setB.has(name));
  const onlyB = chainB.filter((name) => !setA.has(name));
  const different =
    chainA.length !== chainB.length ||
    chainA.some((name, index) => chainB[index] !== name);
  return { chainA, chainB, onlyA, onlyB, different };
}

export async function findMatnPairsByPrefix(limit = 2, prefixLength = DEFAULT_PREFIX_LENGTH) {
  const client = await getClient();
  try {
    const groupLimit = Math.max(limit * 3, 6);
    const { rows } = await client.query<{ ids: number[] }>(
      `
        WITH normalized AS (
          SELECT
            h.id,
            regexp_replace(lower(m.text_en), '\\s+', ' ', 'g') AS normalized
          FROM hadith h
          JOIN matn m ON m.id = h.matn_id
          WHERE h.deleted_at IS NULL
            AND length(trim(coalesce(m.text_en, ''))) > 0
        ),
        grouped AS (
          SELECT left(normalized, $1) AS prefix,
                 array_agg(id ORDER BY id) AS ids,
                 count(*) AS cnt
          FROM normalized
          GROUP BY 1
          HAVING COUNT(*) >= 2
          ORDER BY cnt DESC
          LIMIT $2
        )
        SELECT ids FROM grouped
      `,
      [prefixLength, groupLimit],
    );
    const pairs: Array<[number, number]> = [];
    for (const row of rows) {
      const ids = row.ids ?? [];
      if (ids.length < 2) continue;
      pairs.push([ids[0], ids[1]]);
      if (pairs.length >= limit) break;
    }
    return pairs;
  } finally {
    client.release();
  }
}

export async function findHadithIdsByMatnSimilarity(
  text: string,
  limit = 6,
  threshold = 0.75,
): Promise<MatnSimilarityCandidate[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<MatnSimilarityCandidate>(
      `
        SELECT h.id, similarity(m.text_en, $1) AS score
        FROM hadith h
        JOIN matn m ON m.id = h.matn_id
        WHERE h.deleted_at IS NULL
          AND length(trim(coalesce(m.text_en, ''))) > 0
          AND m.text_en % $1
          AND similarity(m.text_en, $1) >= $2
        ORDER BY score DESC
        LIMIT $3
      `,
      [text, threshold, Math.min(Math.max(1, limit), 20)],
    );
    return rows.map((row) => ({ id: row.id, score: Number(row.score) }));
  } finally {
    client.release();
  }
}

export async function loadHadithInsights(ids: number[]) {
  if (!ids.length) return [];
  const hadiths = await getHadithByIds(ids);
  const map = new Map(hadiths.map((hadith) => [Number(hadith.id), hadith]));
  return ids.map((id) => map.get(id)).filter(Boolean) as HadithInsight[];
}
