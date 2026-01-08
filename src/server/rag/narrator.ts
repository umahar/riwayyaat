import { getClient } from "@/server/db/client";

export type NarratorMatch = {
  id: number;
  name: string;
};

export type NarratorDetail = {
  id: number;
  name: string;
  descriptor: string | null;
  lifespan: string | null;
  tiers: string[];
  reliabilities: string[];
  methods: string[];
};

export type NarratorAggregate = {
  id: number;
  name: string;
  count: number;
};

export type NarratorCount = NarratorAggregate;

const STOPWORDS = [
  "ibn",
  "bin",
  "bint",
  "abu",
  "umm",
  "al",
  "el",
  "ibn.",
  "bin.",
  "bint.",
  "abu.",
  "umm.",
];

const normalizeNarrator = (value: string) => {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const stripStopwords = (value: string) => {
  const tokens = normalizeNarrator(value).split(" ");
  return tokens.filter((token) => token && !STOPWORDS.includes(token)).join(" ");
};

const buildNarratorPatterns = (value: string) => {
  const raw = value.trim();
  const normalized = normalizeNarrator(value);
  const compact = normalized.replace(/\s+/g, "");
  const stripped = stripStopwords(value);
  const patterns = new Set<string>();
  [raw, normalized, compact, stripped].forEach((pattern) => {
    if (!pattern || pattern.length < 2) return;
    patterns.add(`%${pattern}%`);
  });
  return Array.from(patterns);
};

export async function findNarratorsByName(name: string, limit = 5): Promise<NarratorMatch[]> {
  const client = await getClient();
  try {
    const patterns = buildNarratorPatterns(name);
    if (!patterns.length) return [];
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT n.id, n.name
        FROM narrator n
        LEFT JOIN narrator_alias na ON na.narrator_id = n.id
        WHERE n.name ILIKE ANY($1) OR na.alias ILIKE ANY($1)
        GROUP BY n.id, n.name
        ORDER BY length(n.name), n.name
        LIMIT $2
      `,
      [patterns, Math.max(1, Math.min(limit, 10))],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function findNarratorsByNameInHadith(
  name: string,
  hadithId: number,
  limit = 5,
): Promise<NarratorMatch[]> {
  const client = await getClient();
  try {
    const patterns = buildNarratorPatterns(name);
    if (!patterns.length) return [];
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT DISTINCT n.id, n.name
        FROM narrator n
        JOIN chain_narrator cn ON cn.narrator_id = n.id
        JOIN hadith_chain hc ON hc.id = cn.chain_id
        LEFT JOIN narrator_alias na ON na.narrator_id = n.id
        WHERE hc.hadith_id = $1
          AND (n.name ILIKE ANY($2) OR na.alias ILIKE ANY($2))
        ORDER BY length(n.name), n.name
        LIMIT $3
      `,
      [hadithId, patterns, Math.max(1, Math.min(limit, 10))],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function findExactNarratorByName(name: string): Promise<NarratorMatch | null> {
  const client = await getClient();
  try {
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT n.id, n.name
        FROM narrator n
        LEFT JOIN narrator_alias na ON na.narrator_id = n.id
        WHERE lower(n.name) = lower($1)
           OR lower(na.alias) = lower($1)
        ORDER BY length(n.name), n.name
        LIMIT 1
      `,
      [name],
    );
    return rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function findNarratorsByAlias(name: string, limit = 5): Promise<NarratorMatch[]> {
  const client = await getClient();
  const stripped = stripStopwords(name);
  if (!stripped) return [];
  try {
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT n.id, n.name
        FROM narrator n
        LEFT JOIN narrator_alias na ON na.narrator_id = n.id
        WHERE regexp_replace(lower(n.name), '[^a-z0-9\\s]', ' ', 'g') ILIKE $1
           OR na.normalized ILIKE $1
        GROUP BY n.id, n.name
        ORDER BY length(n.name), n.name
        LIMIT $2
      `,
      [`%${stripped}%`, Math.max(1, Math.min(limit, 10))],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function getNarratorDetailsById(id: number): Promise<NarratorDetail | null> {
  const client = await getClient();
  try {
    const { rows } = await client.query<NarratorDetail>(
      `
        SELECT
          n.id,
          n.name,
          n.descriptor,
          n.lifespan,
          array_remove(array_agg(DISTINCT nt.name), NULL) AS tiers,
          array_remove(array_agg(DISTINCT rt.name), NULL) AS reliabilities,
          array_remove(array_agg(DISTINCT tm.name), NULL) AS methods
        FROM narrator n
        LEFT JOIN chain_narrator cn ON cn.narrator_id = n.id
        LEFT JOIN narrator_tier nt ON nt.id = cn.classification_id
        LEFT JOIN reliability_tier rt ON rt.id = cn.reliability_id
        LEFT JOIN transmission_method tm ON tm.id = cn.transmission_method_id
        WHERE n.id = $1
        GROUP BY n.id, n.name, n.descriptor, n.lifespan
        LIMIT 1
      `,
      [id],
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      tiers: rows[0].tiers ?? [],
      reliabilities: rows[0].reliabilities ?? [],
      methods: rows[0].methods ?? [],
    };
  } finally {
    client.release();
  }
}

export async function getNarratorDetailsByName(name: string): Promise<NarratorDetail | null> {
  const client = await getClient();
  try {
    const { rows } = await client.query<NarratorDetail>(
      `
        SELECT
          n.id,
          n.name,
          n.descriptor,
          n.lifespan,
          array_remove(array_agg(DISTINCT nt.name), NULL) AS tiers,
          array_remove(array_agg(DISTINCT rt.name), NULL) AS reliabilities,
          array_remove(array_agg(DISTINCT tm.name), NULL) AS methods
        FROM narrator n
        LEFT JOIN chain_narrator cn ON cn.narrator_id = n.id
        LEFT JOIN narrator_tier nt ON nt.id = cn.classification_id
        LEFT JOIN reliability_tier rt ON rt.id = cn.reliability_id
        LEFT JOIN transmission_method tm ON tm.id = cn.transmission_method_id
        WHERE lower(n.name) = lower($1)
        GROUP BY n.id, n.name, n.descriptor, n.lifespan
        LIMIT 1
      `,
      [name],
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      tiers: rows[0].tiers ?? [],
      reliabilities: rows[0].reliabilities ?? [],
      methods: rows[0].methods ?? [],
    };
  } finally {
    client.release();
  }
}

export async function fetchTopNarrators(params: {
  sourceId?: number | null;
  bookIds?: number[] | null;
  chapterIds?: number[] | null;
  limit?: number;
}): Promise<NarratorAggregate[]> {
  const client = await getClient();
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 20) : 5;
  const bookIds = params.bookIds?.length ? params.bookIds : null;
  const chapterIds = params.chapterIds?.length ? params.chapterIds : null;
  try {
    const { rows } = await client.query<NarratorAggregate>(
      `
        SELECT n.id, n.name, COUNT(*)::int AS count
        FROM chain_narrator cn
        JOIN hadith_chain hc ON hc.id = cn.chain_id
        JOIN hadith h ON h.id = hc.hadith_id
        JOIN narrator n ON n.id = cn.narrator_id
        WHERE h.deleted_at IS NULL
          AND ($1::int IS NULL OR h.source_id = $1)
          AND ($2::int[] IS NULL OR h.book_id = ANY($2))
          AND ($3::int[] IS NULL OR h.chapter_id = ANY($3))
        GROUP BY n.id, n.name
        ORDER BY count DESC, n.name
        LIMIT $4
      `,
      [params.sourceId ?? null, bookIds, chapterIds, limit],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function findHadithIdsByNarratorName(params: {
  name: string;
  sourceId?: number | null;
  limit?: number;
}): Promise<number[]> {
  const client = await getClient();
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 50) : 20;
  try {
    const { rows } = await client.query<{ id: number }>(
      `
        SELECT DISTINCT h.id
        FROM narrator n
        LEFT JOIN narrator_alias na ON na.narrator_id = n.id
        JOIN chain_narrator cn ON cn.narrator_id = n.id
        JOIN hadith_chain hc ON hc.id = cn.chain_id AND hc.is_primary = true
        JOIN hadith h ON h.id = hc.hadith_id
        WHERE h.deleted_at IS NULL
          AND ($2::int IS NULL OR h.source_id = $2)
          AND (n.name ILIKE $1 OR na.alias ILIKE $1)
        ORDER BY h.id
        LIMIT $3
      `,
      [`%${params.name}%`, params.sourceId ?? null, limit],
    );
    return rows.map((row) => row.id);
  } finally {
    client.release();
  }
}

export async function findNarratorIntersectionForHadiths(hadithIds: number[]): Promise<NarratorMatch[]> {
  const unique = Array.from(new Set(hadithIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (unique.length < 2) return [];
  const client = await getClient();
  try {
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT n.id, n.name
        FROM chain_narrator cn
        JOIN hadith_chain hc ON hc.id = cn.chain_id AND hc.is_primary = true
        JOIN narrator n ON n.id = cn.narrator_id
        WHERE hc.hadith_id = ANY($1::int[])
        GROUP BY n.id, n.name
        HAVING COUNT(DISTINCT hc.hadith_id) = $2
        ORDER BY n.name
      `,
      [unique, unique.length],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function findHadithIdsByNarratorPair(params: {
  firstNarratorIds: number[];
  secondNarratorIds: number[];
  sourceId?: number | null;
  limit?: number;
}): Promise<number[]> {
  const firstIds = params.firstNarratorIds.filter((id) => Number.isFinite(id) && id > 0);
  const secondIds = params.secondNarratorIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!firstIds.length || !secondIds.length) return [];
  const client = await getClient();
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 50) : 20;
  try {
    const { rows } = await client.query<{ id: number }>(
      `
        SELECT DISTINCT h.id
        FROM hadith h
        JOIN hadith_chain hc ON hc.hadith_id = h.id AND hc.is_primary = true
        JOIN chain_narrator cn1 ON cn1.chain_id = hc.id
        JOIN chain_narrator cn2 ON cn2.chain_id = hc.id
        WHERE h.deleted_at IS NULL
          AND ($3::int IS NULL OR h.source_id = $3)
          AND cn1.narrator_id = ANY($1::int[])
          AND cn2.narrator_id = ANY($2::int[])
          AND cn2.position = cn1.position + 1
        ORDER BY h.id
        LIMIT $4
      `,
      [firstIds, secondIds, params.sourceId ?? null, limit],
    );
    return rows.map((row) => row.id);
  } finally {
    client.release();
  }
}

export async function fetchTopNarratorsByUniqueChains(params: {
  sourceId?: number | null;
  limit?: number;
}): Promise<NarratorCount[]> {
  const client = await getClient();
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 20) : 5;
  try {
    const { rows } = await client.query<NarratorCount>(
      `
        SELECT n.id, n.name, COUNT(DISTINCT cn.chain_id)::int AS count
        FROM chain_narrator cn
        JOIN hadith_chain hc ON hc.id = cn.chain_id
        JOIN hadith h ON h.id = hc.hadith_id
        JOIN narrator n ON n.id = cn.narrator_id
        WHERE h.deleted_at IS NULL
          AND ($1::int IS NULL OR h.source_id = $1)
        GROUP BY n.id, n.name
        ORDER BY count DESC, n.name
        LIMIT $2
      `,
      [params.sourceId ?? null, limit],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function fetchChainHeadNarrators(params: {
  sourceId?: number | null;
  limit?: number;
}): Promise<NarratorMatch[]> {
  const client = await getClient();
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 50) : 20;
  try {
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT DISTINCT n.id, n.name
        FROM hadith h
        JOIN hadith_chain hc ON hc.hadith_id = h.id AND hc.is_primary = true
        JOIN chain_narrator cn ON cn.chain_id = hc.id AND cn.position = 1
        JOIN narrator n ON n.id = cn.narrator_id
        WHERE h.deleted_at IS NULL
          AND ($1::int IS NULL OR h.source_id = $1)
        ORDER BY n.name
        LIMIT $2
      `,
      [params.sourceId ?? null, limit],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function fetchNarratorsByTier(params: {
  sourceId?: number | null;
  tierQuery: string;
  excludeQuery?: string;
  limit?: number;
}): Promise<NarratorMatch[]> {
  const client = await getClient();
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 50) : 20;
  try {
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT DISTINCT n.id, n.name
        FROM chain_narrator cn
        JOIN narrator n ON n.id = cn.narrator_id
        JOIN narrator_tier nt ON nt.id = cn.classification_id
        JOIN hadith_chain hc ON hc.id = cn.chain_id
        JOIN hadith h ON h.id = hc.hadith_id
        WHERE h.deleted_at IS NULL
          AND ($1::int IS NULL OR h.source_id = $1)
          AND nt.name ILIKE $2
          AND ($3::text IS NULL OR nt.name NOT ILIKE $3)
        ORDER BY n.name
        LIMIT $4
      `,
      [
        params.sourceId ?? null,
        `%${params.tierQuery}%`,
        params.excludeQuery ? `%${params.excludeQuery}%` : null,
        limit,
      ],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function fetchTopNarratorsByHadithIds(
  hadithIds: number[],
  limit = 10,
): Promise<NarratorCount[]> {
  const unique = Array.from(new Set(hadithIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (!unique.length) return [];
  const client = await getClient();
  const safeLimit = limit > 0 ? Math.min(Math.trunc(limit), 20) : 10;
  try {
    const { rows } = await client.query<NarratorCount>(
      `
        SELECT n.id, n.name, COUNT(*)::int AS count
        FROM chain_narrator cn
        JOIN hadith_chain hc ON hc.id = cn.chain_id
        JOIN narrator n ON n.id = cn.narrator_id
        WHERE hc.hadith_id = ANY($1::int[])
        GROUP BY n.id, n.name
        ORDER BY count DESC, n.name
        LIMIT $2
      `,
      [unique, safeLimit],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function fetchNarratorsWithSingleOccurrence(params: {
  sourceId?: number | null;
  limit?: number;
}): Promise<NarratorCount[]> {
  const client = await getClient();
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 50) : 20;
  try {
    const { rows } = await client.query<NarratorCount>(
      `
        SELECT n.id, n.name, COUNT(*)::int AS count
        FROM chain_narrator cn
        JOIN hadith_chain hc ON hc.id = cn.chain_id
        JOIN hadith h ON h.id = hc.hadith_id
        JOIN narrator n ON n.id = cn.narrator_id
        WHERE h.deleted_at IS NULL
          AND ($1::int IS NULL OR h.source_id = $1)
        GROUP BY n.id, n.name
        HAVING COUNT(*) = 1
        ORDER BY n.name
        LIMIT $2
      `,
      [params.sourceId ?? null, limit],
    );
    return rows;
  } finally {
    client.release();
  }
}

export async function countUniqueNarrators(params: { sourceId?: number | null }): Promise<number> {
  const client = await getClient();
  try {
    const { rows } = await client.query<{ count: string | number }>(
      `
        SELECT COUNT(DISTINCT n.id) AS count
        FROM chain_narrator cn
        JOIN hadith_chain hc ON hc.id = cn.chain_id
        JOIN hadith h ON h.id = hc.hadith_id
        JOIN narrator n ON n.id = cn.narrator_id
        WHERE h.deleted_at IS NULL
          AND ($1::int IS NULL OR h.source_id = $1)
      `,
      [params.sourceId ?? null],
    );
    return Number(rows[0]?.count ?? 0);
  } finally {
    client.release();
  }
}
