import { findHadithIdBySourceAndNumber, findSourcesByName } from "@/server/rag/hadith-lookup";

type SourceNumberMatch = { sourceQuery: string; number: number; hint?: string };

type ResolvedSourceNumber = { hadithId: number; sourceId: number; sourceName: string; number: number };

const SOURCE_HINTS = [
  "bukhari",
  "muslim",
  "tirmidhi",
  "nasai",
  "nasa'i",
  "abu dawud",
  "ibn majah",
  "muwatta",
  "malik",
  "ahmad",
  "bayhaqi",
  "tabarani",
  "darimi",
  "hakim",
  "mu'jam",
];

const TRIM_TRAILING = /\b(?:narrate|narrates|narrated|report|reports|reported|say|says|said|mean|means|teach|teaches|about|regarding)\b.*$/i;
const SOURCE_PREFIXES = ["sahih", "sunan", "jami", "musnad", "musannaf", "mu'jam", "muwatta"];
const AL_PREFIX = "(?:al[-\\s]|an[-\\s])?";
const DASH_VARIANTS = /[\u2010-\u2015\u2212]/g;

function normalizeSourceQuery(value: string) {
  return value
    .replace(/["“”]/g, "")
    .replace(DASH_VARIANTS, "-")
    .replace(/\s+-\s*(?:hadith|no\.?|#|id|\d+).*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[,:;]+$/, "")
    .replace(TRIM_TRAILING, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHintInput(value: string) {
  return value
    .normalize("NFKD")
    .replace(DASH_VARIANTS, "-")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function detectSourceHint(text: string): string | null {
  const normalized = normalizeHintInput(text);
  return SOURCE_HINTS.find((hint) => normalized.includes(hint)) ?? null;
}

function hasComparisonSignal(text: string): boolean {
  return /\b(compare|between|versus|vs|and)\b/i.test(text);
}

function isCountToken(text: string, index: number): boolean {
  const tail = text.slice(index).toLowerCase();
  return /\b(?:\d+)\s+(?:hadith|hadiths|narration|narrations|reports)\b/.test(tail);
}

function findPrefixedSource(question: string, hint: string): string | null {
  const escapedHint = escapeRegExp(hint);
  const escapedPrefixes = SOURCE_PREFIXES.map((prefix) => escapeRegExp(prefix)).join("|");
  const pattern = new RegExp(`\\b(?:${escapedPrefixes})\\s+${AL_PREFIX}${escapedHint}\\b`, "i");
  const normalizedQuestion = normalizeHintInput(question);
  const match = normalizedQuestion.match(pattern);
  if (!match?.[0]) return null;
  const normalized = normalizeSourceQuery(match[0]);
  return normalized || null;
}

function buildMatch(
  sourceQueryRaw: string,
  numberRaw: string,
  hintFromQuestion: string | null,
): SourceNumberMatch | null {
  const number = Number(numberRaw);
  if (!Number.isFinite(number) || number <= 0) return null;
  const sourceQuery = normalizeSourceQuery(sourceQueryRaw);
  if (!sourceQuery || !/[a-z]/i.test(sourceQuery)) return null;
  const hint = detectSourceHint(sourceQuery) ?? hintFromQuestion ?? undefined;
  return { sourceQuery, number, hint };
}

export function parseSourceNumbersFromQuestion(question: string): SourceNumberMatch[] {
  const normalized = normalizeHintInput(question);
  const hintFromQuestion = detectSourceHint(normalized);
  const matches: SourceNumberMatch[] = [];
  const seen = new Set<string>();

  const direct = question.match(/\b(\d+)\b\s*(?:in|from)\s+([^?.!]+)/i);
  if (direct?.[1] && direct?.[2]) {
    const match = buildMatch(direct[2], direct[1], hintFromQuestion);
    if (match) {
      const key = `${match.sourceQuery.toLowerCase()}::${match.number}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push(match);
      }
    }
  }

  const sourceFirst = question.match(/\b(?:in|from)\s+([^?.!]+?)\s*(?:hadith\s*)?(?:no\.?|#)?\s*(\d+)\b/i);
  if (sourceFirst?.[1] && sourceFirst?.[2]) {
    const match = buildMatch(sourceFirst[1], sourceFirst[2], hintFromQuestion);
    if (match) {
      const key = `${match.sourceQuery.toLowerCase()}::${match.number}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push(match);
      }
    }
  }

  for (const hint of SOURCE_HINTS) {
    const escapedHint = escapeRegExp(hint);
    const afterPattern = new RegExp(
      `\\b${escapedHint}\\b\\s*[:#-]?\\s*(?:hadith\\s*)?(?:no\\.?|#)?\\s*(\\d+)\\b`,
      "ig",
    );
    const beforePattern = new RegExp(
      `\\b(\\d+)\\b\\s*(?:in|from)?\\s*${escapedHint}\\b`,
      "ig",
    );
    const prefixed = findPrefixedSource(question, hint);
    const afterMatches = normalized.matchAll(afterPattern);
    const beforeMatches = normalized.matchAll(beforePattern);
    for (const match of [...afterMatches, ...beforeMatches]) {
      const raw = match?.[1];
      if (!raw) continue;
      const number = Number(raw);
      if (!Number.isFinite(number) || number <= 0) continue;
      const sourceQuery = prefixed ?? hint;
      const key = `${sourceQuery.toLowerCase()}::${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ sourceQuery, number, hint });
    }
  }

  if (matches.length < 2 && hintFromQuestion && hasComparisonSignal(question)) {
    const prefixed = findPrefixedSource(question, hintFromQuestion);
    const sourceQuery = prefixed ?? hintFromQuestion;
    const numberMatches = Array.from(normalized.matchAll(/\b(\d+)\b/g));
    for (const match of numberMatches) {
      const raw = match?.[1];
      if (!raw) continue;
      const number = Number(raw);
      if (!Number.isFinite(number) || number <= 0) continue;
      if (match.index != null && isCountToken(normalized, match.index)) continue;
      const key = `${sourceQuery.toLowerCase()}::${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ sourceQuery, number, hint: hintFromQuestion });
    }
  }

  return matches;
}

export function buildSourceNumberMatchesFromSources(
  question: string,
  sources: Array<{ name: string; aliases?: string[] | null }>,
): SourceNumberMatch[] {
  if (!sources.length) return [];
  const normalized = normalizeHintInput(question);
  const matches: SourceNumberMatch[] = [];
  const seen = new Set<string>();
  const mentions: Array<{ source: { name: string }; index: number; length: number }> = [];

  for (const source of sources) {
    const tokens = [source.name, ...(source.aliases ?? [])].filter(Boolean);
    for (const token of tokens) {
      const needle = normalizeHintInput(token);
      if (!needle) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(needle)}\\b`, "g");
      for (const match of normalized.matchAll(pattern)) {
        if (match.index == null) continue;
        mentions.push({ source: { name: source.name }, index: match.index, length: match[0].length });
      }
    }
  }

  mentions.sort((a, b) => a.index - b.index);
  for (let i = 0; i < mentions.length; i += 1) {
    const current = mentions[i];
    const next = mentions[i + 1];
    const start = current.index + current.length;
    const end = next ? next.index : normalized.length;
    const segment = normalized.slice(start, end);
    const numberMatches = Array.from(segment.matchAll(/\b(\d+)\b/g));
    for (const match of numberMatches) {
      const raw = match?.[1];
      if (!raw) continue;
      const number = Number(raw);
      if (!Number.isFinite(number) || number <= 0) continue;
      if (match.index != null && isCountToken(segment, match.index)) continue;
      const key = `${current.source.name.toLowerCase()}::${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        sourceQuery: current.source.name,
        number,
        hint: detectSourceHint(current.source.name) ?? undefined,
      });
    }
  }

  if (!matches.length && sources.length === 1) {
    const source = sources[0];
    const numberMatches = Array.from(normalized.matchAll(/\b(\d+)\b/g));
    for (const match of numberMatches) {
      const raw = match?.[1];
      if (!raw) continue;
      const number = Number(raw);
      if (!Number.isFinite(number) || number <= 0) continue;
      if (match.index != null && isCountToken(normalized, match.index)) continue;
      const key = `${source.name.toLowerCase()}::${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        sourceQuery: source.name,
        number,
        hint: detectSourceHint(source.name) ?? undefined,
      });
    }
  }

  return matches;
}

export async function resolveSourceNumberMatch(match: SourceNumberMatch): Promise<ResolvedSourceNumber | null> {
  let sources = await findSourcesByName(match.sourceQuery, 5);
  if (!sources.length && match.hint && match.hint !== match.sourceQuery) {
    sources = await findSourcesByName(match.hint, 5);
  }
  if (!sources.length) return null;
  const normalizedQuery = match.sourceQuery.toLowerCase();
  const exact = sources.find((source) => source.name.toLowerCase() === normalizedQuery) ?? null;
  let selected = exact ?? (sources.length === 1 ? sources[0] : null);
  if (!selected && sources.length > 1) {
    const scored = sources
      .map((source) => {
        const name = source.name.toLowerCase();
        const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
        let score = 0;
        for (const token of tokens) {
          if (name.includes(token)) score += 2;
        }
        if (name === normalizedQuery) score += 5;
        if (normalizedQuery.includes("sahih") && name.includes("sahih")) score += 1;
        return { source, score };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const second = scored[1];
    if (best && best.score > 0 && (!second || best.score - second.score >= 1)) {
      selected = best.source;
    }
  }
  if (!selected) return null;

  const hadithId = await findHadithIdBySourceAndNumber(selected.id, match.number);
  if (!hadithId) return null;

  return {
    hadithId,
    sourceId: selected.id,
    sourceName: selected.name,
    number: match.number,
  };
}

export function parseSourceNumberFromQuestion(question: string): SourceNumberMatch | null {
  return parseSourceNumbersFromQuestion(question)[0] ?? null;
}

export async function resolveSourceNumberQuestion(question: string): Promise<ResolvedSourceNumber | null> {
  const match = parseSourceNumberFromQuestion(question);
  if (!match) return null;
  return resolveSourceNumberMatch(match);
}
