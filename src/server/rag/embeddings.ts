// Mark server-only in Next.js; ignore when running standalone scripts (tsx/node).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop for script contexts */
}
import OpenAI from "openai";
import { getClient } from "@/server/db/client";

export const DEFAULT_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536; // matches migration constraint
const BATCH_SIZE = 32; // inputs per OpenAI call

type HadithText = {
  id: number;
  text: string;
};

type EmbeddingRow = {
  hadithId: number;
  embedding: number[];
  model: string;
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

async function fetchHadithTexts(hadithIds: number[]): Promise<HadithText[]> {
  if (!hadithIds.length) return [];
  const client = await getClient();
  try {
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
    const insertValues = rows.flatMap((row) => [row.hadithId, row.model, `[${row.embedding.join(",")}]`]);
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

async function embedTexts(texts: HadithText[], model: string): Promise<EmbeddingRow[]> {
  if (!texts.length) return [];
  const vectors = await embedTextsDirect(
    texts.map((t) => t.text),
    model,
  );
  return vectors.map((vec, index) => {
    return { hadithId: texts[index].id, embedding: vec, model };
  });
}

export async function embedHadithBatch(hadithIds: number[], model = DEFAULT_EMBEDDING_MODEL) {
  let embeddedCount = 0;
  // Chunk inputs to keep OpenAI payloads reasonable.
  for (let i = 0; i < hadithIds.length; i += BATCH_SIZE) {
    const slice = hadithIds.slice(i, i + BATCH_SIZE);
    const texts = await fetchHadithTexts(slice);
    if (!texts.length) continue;
    const embeddings = await embedTexts(texts, model);
    await saveEmbeddings(embeddings);
    embeddedCount += embeddings.length;
    // optional: log progress
    // console.log(`[embed] saved ${embeddings.length} embeddings`);
  }
  return embeddedCount;
}

export async function embedAllMissingHadith(
  model = DEFAULT_EMBEDDING_MODEL,
  batchSize = BATCH_SIZE,
  options: EmbedAllOptions = {},
) {
  const client = await getClient();
  try {
    const showProgress = Boolean(options.progress);
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
            AND length(trim(coalesce(m.text_en, ''))) > 0
        `,
        [model],
      );
      totalMissing = Number(total.rows[0]?.count ?? 0);
      console.log(`[rag-backfill] Missing ${totalMissing} embeddings (batch size ${batchSize})`);
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
            AND length(trim(coalesce(m.text_en, ''))) > 0
          ORDER BY h.id
          LIMIT $2
        `,
        [model, batchSize],
      );
      if (!rows.length) break;
      const ids = rows.map((r) => r.id);
      const embedded = await embedHadithBatch(ids, model);
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
