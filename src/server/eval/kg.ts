// Mark server-only in Next.js; ignore when running standalone scripts (tsx/node).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop for script contexts */
}
import { getClient } from "@/server/db/client";
import type { KgCoverageSummary, QueryKgCoverage } from "@/types/evaluation";

export const KG_SLOTS = [
  { key: "displayNumber", label: "Display number" },
  { key: "book", label: "Book link" },
  { key: "chapter", label: "Chapter link" },
  { key: "location", label: "Location label" },
  { key: "primaryChain", label: "Primary chain" },
  { key: "chainNarrators", label: "Chain narrators" },
  { key: "identifiers", label: "Identifiers" },
  { key: "grades", label: "Grades" },
  { key: "tags", label: "Tags" },
] as const;

export type KgSlotKey = (typeof KG_SLOTS)[number]["key"];

export type HadithCoverageRow = {
  hadithId: number;
  slots: Record<KgSlotKey, boolean>;
  hasIsnadDetail: boolean;
};

export async function fetchHadithCoverage(ids: number[]): Promise<HadithCoverageRow[]> {
  if (!ids.length) return [];
  const client = await getClient();
  try {
    const { rows } = await client.query<{
      id: number;
      has_display: boolean;
      has_book: boolean;
      has_chapter: boolean;
      has_location: boolean;
      has_chain: boolean;
      has_chain_narrators: boolean;
      has_identifiers: boolean;
      has_grades: boolean;
      has_tags: boolean;
    }>(
      `
        SELECT
          h.id,
          COALESCE(NULLIF(h.display_number, ''), NULL) IS NOT NULL AS has_display,
          h.book_id IS NOT NULL AS has_book,
          h.chapter_id IS NOT NULL AS has_chapter,
          COALESCE(NULLIF(h.location, ''), NULL) IS NOT NULL AS has_location,
          EXISTS (
            SELECT 1
            FROM hadith_chain hc
            WHERE hc.hadith_id = h.id
          ) AS has_chain,
          EXISTS (
            SELECT 1
            FROM hadith_chain hc
            JOIN chain_narrator cn ON cn.chain_id = hc.id
            WHERE hc.hadith_id = h.id
          ) AS has_chain_narrators,
          EXISTS (
            SELECT 1
            FROM hadith_identifier hi
            WHERE hi.hadith_id = h.id
          ) AS has_identifiers,
          EXISTS (
            SELECT 1
            FROM hadith_grade hg
            WHERE hg.hadith_id = h.id
          ) AS has_grades,
          EXISTS (
            SELECT 1
            FROM hadith_tag ht
            WHERE ht.hadith_id = h.id
          ) AS has_tags
        FROM hadith h
        WHERE h.id = ANY($1::int[])
      `,
      [ids],
    );
    return rows.map((row) => ({
      hadithId: row.id,
      slots: {
        displayNumber: row.has_display,
        book: row.has_book,
        chapter: row.has_chapter,
        location: row.has_location,
        primaryChain: row.has_chain,
        chainNarrators: row.has_chain_narrators,
        identifiers: row.has_identifiers,
        grades: row.has_grades,
        tags: row.has_tags,
      },
      hasIsnadDetail: row.has_chain_narrators,
    }));
  } finally {
    client.release();
  }
}

function summarizeInternal(rows: HadithCoverageRow[]): KgCoverageSummary {
  if (!rows.length) {
    return {
      hadithCount: 0,
      overallPercent: 0,
      isnadPercent: 0,
      slots: KG_SLOTS.map((slot) => ({
        key: slot.key,
        label: slot.label,
        filled: 0,
        total: 0,
        percentage: 0,
      })),
    };
  }
  const slotCounts: Record<KgSlotKey, number> = {
    displayNumber: 0,
    book: 0,
    chapter: 0,
    location: 0,
    primaryChain: 0,
    chainNarrators: 0,
    identifiers: 0,
    grades: 0,
    tags: 0,
  };
  let isnadFilled = 0;
  for (const row of rows) {
    for (const slot of KG_SLOTS) {
      if (row.slots[slot.key]) slotCounts[slot.key] += 1;
    }
    if (row.hasIsnadDetail) isnadFilled += 1;
  }
  const totalSlots = rows.length * KG_SLOTS.length;
  const filledSlots = Object.values(slotCounts).reduce((sum, value) => sum + value, 0);
  return {
    hadithCount: rows.length,
    overallPercent: totalSlots ? (filledSlots / totalSlots) * 100 : 0,
    isnadPercent: rows.length ? (isnadFilled / rows.length) * 100 : 0,
    slots: KG_SLOTS.map((slot) => ({
      key: slot.key,
      label: slot.label,
      filled: slotCounts[slot.key],
      total: rows.length,
      percentage: rows.length ? (slotCounts[slot.key] / rows.length) * 100 : 0,
    })),
  };
}

export function summarizeCoverage(rows: HadithCoverageRow[]): KgCoverageSummary {
  return summarizeInternal(rows);
}

export function summarizeCoverageForQuery(rows: HadithCoverageRow[]): QueryKgCoverage | undefined {
  if (!rows.length) return undefined;
  const summary = summarizeInternal(rows);
  return {
    hadithCount: summary.hadithCount,
    overallPercent: summary.overallPercent,
    isnadPercent: summary.isnadPercent,
  };
}
