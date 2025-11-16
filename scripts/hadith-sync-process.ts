import "dotenv/config";
import { processHadithSyncBatch } from "@/server/sync/hadith-sync";

/**
 * Processes pending per-hadith sync tasks:
 * - Neo4j projection refresh for the hadith
 * - Embedding refresh for the hadith matn
 *
 * Run: npm run sync:delta
 * Env: uses .env.local via dotenv; requires both PG and Neo4j access.
 */
async function main() {
  const limit = process.env.SYNC_LIMIT ? Number(process.env.SYNC_LIMIT) : 50;
  console.log(`[hadith-sync] Processing up to ${limit} pending items...`);
  await processHadithSyncBatch(Number.isFinite(limit) && limit > 0 ? limit : 50);
  console.log("[hadith-sync] Done");
}

main().catch((error) => {
  console.error("[hadith-sync] Failed", error);
  process.exit(1);
});
