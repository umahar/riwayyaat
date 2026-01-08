import "dotenv/config";
import { embedAllMissingHadith, getEmbeddingProfiles } from "@/server/rag/embeddings";

/**
 * RAG embedding backfill
 *
 * - Scans for hadith without embeddings for the chosen model.
 * - Generates embeddings with OpenAI and stores them in hadith_embedding (pgvector).
 * - Idempotent: safe to re-run; only missing rows are processed.
 *
 * Run: npm run rag:backfill
 * Env: OPENAI_API_KEY (required), EMBEDDING_MODEL (optional, defaults to text-embedding-3-small)
 * Optional: EMBEDDING_AUGMENTED_MODEL + EMBEDDING_AUGMENTED_STORAGE_KEY (enable augmented embeddings)
 */
async function main() {
  const profiles = getEmbeddingProfiles();
  for (const profile of profiles) {
    console.log(
      `[rag-backfill] Starting backfill for ${profile.label} (provider=${profile.providerModel}, storage=${profile.storageModel})`,
    );
    await embedAllMissingHadith(profile, undefined, { progress: true });
  }
  console.log("[rag-backfill] Completed");
}

main().catch((error) => {
  console.error("[rag-backfill] Failed", error);
  process.exit(1);
});
