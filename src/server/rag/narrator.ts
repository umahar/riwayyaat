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

export async function findNarratorsByName(name: string, limit = 5): Promise<NarratorMatch[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT id, name
        FROM narrator
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

export async function findExactNarratorByName(name: string): Promise<NarratorMatch | null> {
  const client = await getClient();
  try {
    const { rows } = await client.query<NarratorMatch>(
      `
        SELECT id, name
        FROM narrator
        WHERE lower(name) = lower($1)
        LIMIT 1
      `,
      [name],
    );
    return rows[0] ?? null;
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
