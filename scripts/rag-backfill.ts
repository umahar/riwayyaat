import "dotenv/config";
import { embedAllMissingHadith } from "@/server/rag/embeddings";

/**
 * RAG embedding backfill
 *
 * - Scans for hadith without embeddings for the chosen model.
 * - Generates embeddings with OpenAI and stores them in hadith_embedding (pgvector).
 * - Idempotent: safe to re-run; only missing rows are processed.
 *
 * Run: npm run rag:backfill
 * Env: OPENAI_API_KEY (required), EMBEDDING_MODEL (optional, defaults to text-embedding-3-small)
 */
async function main() {
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  console.log(`[rag-backfill] Starting backfill for model=${model}`);
  await embedAllMissingHadith(model, undefined, { progress: true });
  console.log("[rag-backfill] Completed");
}

main().catch((error) => {
  console.error("[rag-backfill] Failed", error);
  process.exit(1);
});
