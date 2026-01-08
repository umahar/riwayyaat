const HADITH_ID_REGEX = /\bhadith\s*(?:id|#|no\.?|number)?\s*[:#]?\s*(\d+)\b/i;
const NARRATOR_ID_REGEX = /\bnarrator\s*(?:id|#)?\s*[:#]?\s*(\d+)\b/i;
const HOPS_REGEX = /(\d+)\s*(?:hop|hops|depth)\b/i;

const CHAIN_KEYWORDS = ["chain", "isnad", "sanad"];
const VARIANT_KEYWORDS = ["variant", "variants", "across sources", "other sources", "different sources"];
const NARRATOR_KEYWORDS = ["narrator", "narrators", "network", "hops", "ego network"];
const NARRATOR_AGGREGATE_KEYWORDS = [
  "most frequent",
  "most common",
  "most mentioned",
  "appear most",
  "appears most",
  "top narrators",
  "top narrator",
  "frequent narrators",
  "common narrators",
];

export type RagIntent =
  | { type: "chain"; hadithId?: number }
  | { type: "variants"; hadithId?: number }
  | { type: "narrator-network"; narratorId?: number; narratorName?: string; depth?: number }
  | { type: "narrator-aggregate" }
  | { type: "hadith"; hadithId: number }
  | { type: "semantic" };

function parseHadithId(question: string): number | undefined {
  const match = question.match(HADITH_ID_REGEX);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

function parseNarratorId(question: string): number | undefined {
  const match = question.match(NARRATOR_ID_REGEX);
  const raw = match?.[1];
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

function parseDepth(question: string): number | undefined {
  const match = question.match(HOPS_REGEX);
  const raw = match?.[1];
  if (!raw) return undefined;
  const depth = Number(raw);
  if (!Number.isFinite(depth) || depth <= 0) return undefined;
  return Math.min(Math.trunc(depth), 3);
}

function extractNarratorName(question: string): string | undefined {
  const match = question.match(/connected to\s+([^,.?]+?)(?:\s+within|\s+in|\?|\.$|$)/i);
  if (!match?.[1]) return undefined;
  const name = match[1].trim();
  return name.length ? name : undefined;
}

function hasAnyKeyword(question: string, keywords: string[]) {
  const lower = question.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

export function inferRagIntent(question: string): RagIntent {
  const hadithId = parseHadithId(question);
  const narratorId = parseNarratorId(question);
  const depth = parseDepth(question);
  const narratorName = extractNarratorName(question);

  if (hasAnyKeyword(question, CHAIN_KEYWORDS)) {
    return { type: "chain", hadithId };
  }
  if (hasAnyKeyword(question, VARIANT_KEYWORDS)) {
    return { type: "variants", hadithId };
  }
  if (hasAnyKeyword(question, NARRATOR_KEYWORDS)) {
    if (hasAnyKeyword(question, NARRATOR_AGGREGATE_KEYWORDS)) {
      return { type: "narrator-aggregate" };
    }
    return { type: "narrator-network", narratorId, narratorName, depth };
  }
  if (hadithId) {
    return { type: "hadith", hadithId };
  }
  return { type: "semantic" };
}
