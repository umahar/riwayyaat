// Mark server-only in Next.js; ignore when running standalone scripts (tsx/node).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop for script contexts */
}
import OpenAI from "openai";
import { getClient } from "@/server/db/client";

export type EmbeddingMode = "matn" | "augmented";
export type EmbeddingProfile = {
  providerModel: string;
  storageModel: string;
  mode: EmbeddingMode;
  label: string;
};

export const DEFAULT_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const AUGMENTED_PROVIDER_MODEL = process.env.EMBEDDING_AUGMENTED_MODEL || DEFAULT_EMBEDDING_MODEL;
const AUGMENTED_STORAGE_MODEL = process.env.EMBEDDING_AUGMENTED_STORAGE_KEY;

export const DEFAULT_EMBEDDING_PROFILE: EmbeddingProfile = {
  providerModel: DEFAULT_EMBEDDING_MODEL,
  storageModel: DEFAULT_EMBEDDING_MODEL,
  mode: "matn",
  label: "matn",
};

export function getAugmentedEmbeddingProfile(): EmbeddingProfile | null {
  if (!AUGMENTED_STORAGE_MODEL) return null;
  return {
    providerModel: AUGMENTED_PROVIDER_MODEL,
    storageModel: AUGMENTED_STORAGE_MODEL,
    mode: "augmented",
    label: "augmented",
  };
}

export function getEmbeddingProfiles(): EmbeddingProfile[] {
  const profiles = [DEFAULT_EMBEDDING_PROFILE];
  const augmented = getAugmentedEmbeddingProfile();
  if (augmented) profiles.push(augmented);
  return profiles;
}
const EMBEDDING_DIMENSION = 1536; // matches migration constraint
const BATCH_SIZE = 32; // inputs per OpenAI call

type HadithText = {
  id: number;
  text: string;
};

type EmbeddingRow = {
  hadithId: number;
  embedding: number[];
  storageModel: string;
};

type EmbedAllOptions = {
  progress?: boolean;
};

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }
  return new OpenAI({ apiKey });
}

// Low-level helper to embed arbitrary text inputs (used by retriever for queries).
export async function embedTextsDirect(
  inputs: string[],
  model = DEFAULT_EMBEDDING_MODEL,
): Promise<number[][]> {
  if (!inputs.length) return [];
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model,
    input: inputs,
  });
  const data = response.data;
  if (data.length !== inputs.length) {
    throw new Error(`Embedding response length mismatch: expected ${inputs.length}, got ${data.length}`);
  }
  return data.map((item, index) => {
    const vec = item.embedding;
    if (vec.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${vec.length} (input idx ${index})`,
      );
    }
    return vec;
  });
}

function joinLimited(values: string[] | null | undefined, limit = 12) {
  if (!values?.length) return null;
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (!unique.length) return null;
  return unique.slice(0, limit).join(", ");
}

function buildAugmentedText(row: {
  id: number;
  text_en: string | null;
  source_name: string;
  display_number: string | null;
  book_name: string | null;
  chapter_name: string | null;
  narration_level: string | null;
  chain_type: string | null;
  attribution_type: string | null;
  tags: string[] | null;
  grades: string[] | null;
  identifiers: string[] | null;
  narrators: string[] | null;
  transmission_methods: string[] | null;
}) {
  const header = `Hadith ${row.display_number ?? row.id} (${row.source_name})`;
  const tags = joinLimited(row.tags);
  const grades = joinLimited(row.grades);
  const identifiers = joinLimited(row.identifiers);
  const narrators = joinLimited(row.narrators);
  const transmissionMethods = joinLimited(row.transmission_methods);
  const parts = [
    row.text_en ? `Matn: ${row.text_en}` : null,
    `Source: ${row.source_name}`,
    row.book_name ? `Book: ${row.book_name}` : null,
    row.chapter_name ? `Chapter: ${row.chapter_name}` : null,
    row.narration_level ? `Narration level: ${row.narration_level}` : null,
    row.chain_type ? `Chain type: ${row.chain_type}` : null,
    row.attribution_type ? `Attribution: ${row.attribution_type}` : null,
    tags ? `Tags: ${tags}` : null,
    grades ? `Grades: ${grades}` : null,
    identifiers ? `Identifiers: ${identifiers}` : null,
    narrators ? `Narrators: ${narrators}` : null,
    transmissionMethods ? `Transmission method: ${transmissionMethods}` : null,
  ].filter(Boolean);
  return [header, ...parts].join(" | ");
}

async function fetchHadithTexts(hadithIds: number[], profile: EmbeddingProfile): Promise<HadithText[]> {
  if (!hadithIds.length) return [];
  const client = await getClient();
  try {
    if (profile.mode === "augmented") {
      const { rows } = await client.query<{
        id: number;
        text_en: string | null;
        source_name: string;
        display_number: string | null;
        book_name: string | null;
        chapter_name: string | null;
        narration_level: string | null;
        chain_type: string | null;
        attribution_type: string | null;
        tags: string[] | null;
        grades: string[] | null;
        identifiers: string[] | null;
        narrators: string[] | null;
        transmission_methods: string[] | null;
      }>(
        `
          SELECT
            h.id,
            m.text_en,
            s.name AS source_name,
            h.display_number,
            b.name AS book_name,
            c.name AS chapter_name,
            nl.name_en AS narration_level,
            ct.name_en AS chain_type,
            at.name_en AS attribution_type,
            tags.tags,
            grades.grades,
            ids.identifiers,
            narrators.narrators,
            methods.transmission_methods
          FROM hadith h
          JOIN matn m ON m.id = h.matn_id
          JOIN source s ON s.id = h.source_id
          LEFT JOIN book b ON b.id = h.book_id
          LEFT JOIN chapter c ON c.id = h.chapter_id
          LEFT JOIN hadith_chain hc ON hc.hadith_id = h.id AND hc.is_primary = true
          LEFT JOIN narration_level nl ON nl.id = hc.narration_level_id
          LEFT JOIN chain_type ct ON ct.id = hc.chain_type_id
          LEFT JOIN attribution_type at ON at.id = hc.attribution_type_id
          LEFT JOIN LATERAL (
            SELECT array_agg(DISTINCT t.name) AS tags
            FROM hadith_tag ht
            JOIN tag t ON t.id = ht.tag_id
            WHERE ht.hadith_id = h.id
          ) tags ON TRUE
          LEFT JOIN LATERAL (
            SELECT array_agg(DISTINCT g.name) AS grades
            FROM hadith_grade hg
            JOIN grade g ON g.id = hg.grade_id
            WHERE hg.hadith_id = h.id
          ) grades ON TRUE
          LEFT JOIN LATERAL (
            SELECT array_agg(hi.scheme_key || ':' || hi.identifier) AS identifiers
            FROM hadith_identifier hi
            WHERE hi.hadith_id = h.id
          ) ids ON TRUE
          LEFT JOIN LATERAL (
            SELECT array_agg(n.name ORDER BY cn.position) AS narrators
            FROM chain_narrator cn
            JOIN narrator n ON n.id = cn.narrator_id
            WHERE cn.chain_id = hc.id
          ) narrators ON TRUE
          LEFT JOIN LATERAL (
            SELECT array_agg(DISTINCT tm.name) AS transmission_methods
            FROM chain_narrator cn
            JOIN transmission_method tm ON tm.id = cn.transmission_method_id
            WHERE cn.chain_id = hc.id
          ) methods ON TRUE
          WHERE h.id = ANY($1::int[])
            AND h.deleted_at IS NULL
        `,
        [hadithIds],
      );
      return rows
        .map((row) => ({
          id: row.id,
          text: buildAugmentedText(row),
        }))
        .filter((row) => row.text.trim().length > 0);
    }

    const { rows } = await client.query<{
      id: number;
      text_en: string | null;
      source_name: string;
      display_number: string | null;
    }>(
      `
        SELECT
          h.id,
          m.text_en,
          s.name AS source_name,
          h.display_number
        FROM hadith h
        JOIN matn m ON m.id = h.matn_id
        JOIN source s ON s.id = h.source_id
        WHERE h.id = ANY($1::int[])
          AND h.deleted_at IS NULL
      `,
      [hadithIds],
    );
    // Embed English matn text; prepend a lightweight identifier for disambiguation.
    // We avoid sanad/metadata to keep the signal grounded in the matn content.
    return rows
      .map((row) => ({
        id: row.id,
        text: row.text_en ? `Hadith ${row.display_number ?? row.id} (${row.source_name}): ${row.text_en}` : "",
      }))
      .filter((row) => row.text.trim().length > 0);
  } finally {
    client.release();
  }
}

async function saveEmbeddings(rows: EmbeddingRow[]) {
  if (!rows.length) return;
  const client = await getClient();
  try {
    // pgvector expects bracketed literals (`[v1,v2,...]`) when passed as text
    const insertValues = rows.flatMap((row) => [row.hadithId, row.storageModel, `[${row.embedding.join(",")}]`]);
    const valuePlaceholders = rows
      .map(
        (_, index) =>
          `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
      )
      .join(", ");
    await client.query(
      `
        INSERT INTO hadith_embedding (hadith_id, model, embedding)
        VALUES ${valuePlaceholders}
        ON CONFLICT (hadith_id, model)
        DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now()
      `,
      insertValues,
    );
  } finally {
    client.release();
  }
}

async function embedTexts(texts: HadithText[], profile: EmbeddingProfile): Promise<EmbeddingRow[]> {
  if (!texts.length) return [];
  const vectors = await embedTextsDirect(
    texts.map((t) => t.text),
    profile.providerModel,
  );
  return vectors.map((vec, index) => {
    return { hadithId: texts[index].id, embedding: vec, storageModel: profile.storageModel };
  });
}

export async function embedHadithBatch(
  hadithIds: number[],
  profile: EmbeddingProfile = DEFAULT_EMBEDDING_PROFILE,
) {
  let embeddedCount = 0;
  // Chunk inputs to keep OpenAI payloads reasonable.
  for (let i = 0; i < hadithIds.length; i += BATCH_SIZE) {
    const slice = hadithIds.slice(i, i + BATCH_SIZE);
    const texts = await fetchHadithTexts(slice, profile);
    if (!texts.length) continue;
    const embeddings = await embedTexts(texts, profile);
    await saveEmbeddings(embeddings);
    embeddedCount += embeddings.length;
    // optional: log progress
    // console.log(`[embed] saved ${embeddings.length} embeddings`);
  }
  return embeddedCount;
}

export async function embedAllMissingHadith(
  profile: EmbeddingProfile = DEFAULT_EMBEDDING_PROFILE,
  batchSize = BATCH_SIZE,
  options: EmbedAllOptions = {},
) {
  const client = await getClient();
  try {
    const showProgress = Boolean(options.progress);
    const textRequirement =
      profile.mode === "matn" ? "AND length(trim(coalesce(m.text_en, ''))) > 0" : "";
    let totalMissing = 0;
    if (showProgress) {
      const total = await client.query<{ count: string }>(
        `
          SELECT COUNT(*) AS count
          FROM hadith h
          JOIN matn m ON m.id = h.matn_id
          LEFT JOIN hadith_embedding he
            ON he.hadith_id = h.id AND he.model = $1
          WHERE he.id IS NULL
            AND h.deleted_at IS NULL
            ${textRequirement}
        `,
        [profile.storageModel],
      );
      totalMissing = Number(total.rows[0]?.count ?? 0);
      console.log(
        `[rag-backfill] Missing ${totalMissing} embeddings for ${profile.label} (batch size ${batchSize})`,
      );
    }
    const startedAt = Date.now();
    let processed = 0;
    // Find hadith missing embeddings for this model.
    // Idempotent: re-run will only process gaps.
    while (true) {
      const { rows } = await client.query<{ id: number }>(
        `
          SELECT h.id
          FROM hadith h
          JOIN matn m ON m.id = h.matn_id
          LEFT JOIN hadith_embedding he
            ON he.hadith_id = h.id AND he.model = $1
          WHERE he.id IS NULL
            AND h.deleted_at IS NULL
            ${textRequirement}
          ORDER BY h.id
          LIMIT $2
        `,
        [profile.storageModel, batchSize],
      );
      if (!rows.length) break;
      const ids = rows.map((r) => r.id);
      const embedded = await embedHadithBatch(ids, profile);
      if (showProgress) {
        processed += embedded;
        const elapsedMs = Date.now() - startedAt;
        const averageMs = processed > 0 ? elapsedMs / processed : 0;
        const remaining = Math.max(totalMissing - processed, 0);
        const etaMs = averageMs * remaining;
        console.log(
          `[rag-backfill] ${processed}/${totalMissing} embedded, remaining ${remaining}, eta ${formatDuration(etaMs)}`,
        );
      }
    }
  } finally {
    client.release();
  }
}
