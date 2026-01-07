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

export async function findNarratorsByName(name: string, limit = 5): Promise<NarratorMatch[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT n.id, n.name
        FROM narrator n
        LEFT JOIN narrator_alias na ON na.narrator_id = n.id
        WHERE n.name ILIKE $1 OR na.alias ILIKE $1
        GROUP BY n.id, n.name
        ORDER BY length(n.name), n.name
        LIMIT $2
      `,
      [`%${name}%`, Math.max(1, Math.min(limit, 10))],
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
