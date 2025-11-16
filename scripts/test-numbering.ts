import assert from "node:assert";
import { getClient } from "@/server/db/client";
import { hadithService } from "@/features/hadith/server/hadith-service";

async function main() {
  // 1) Check DB-level backfill for display_number and identifiers.
  const client = await getClient();
  try {
    const { rows: hadithRows } = await client.query<{ id: number; number: number; display_number: string | null }>(
      "SELECT id, number, display_number FROM hadith ORDER BY id LIMIT 1",
    );
    assert(hadithRows.length > 0, "No hadith rows found; seed the database first");
    const sampleHadith = hadithRows[0];
    assert(
      sampleHadith.display_number,
      `display_number should be populated (hadith.id=${sampleHadith.id}, number=${sampleHadith.number})`,
    );
  } finally {
    client.release();
  }

  // 2) Check API/service shape for displayNumber/displayLabel/identifiers while keeping hadithNumber.
  const [insight] = await hadithService.listHadithInsights();
  assert(insight, "No hadith insights returned; seed the database first");
  assert(
    insight.details.hadithNumber !== undefined,
    "hadithNumber should remain in the payload for backward compatibility",
  );
  assert(
    insight.details.displayNumber,
    "displayNumber should be present (backfilled from legacy number by default)",
  );
  assert(
    insight.details.displayLabel?.includes(String(insight.details.displayNumber)),
    "displayLabel should include the displayNumber",
  );
  assert(
    Array.isArray(insight.identifiers) && insight.identifiers.length > 0,
    "identifiers should expose legacy_source_number rows",
  );
  const legacy = insight.identifiers?.find((id) => id.schemeKey === "legacy_source_number");
  assert(legacy, "legacy_source_number identifier should exist");
  assert(legacy?.isPrimary, "legacy_source_number identifier should be marked primary");
  console.log("[ok] display_number backfill and API fields validated for a sample hadith");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
