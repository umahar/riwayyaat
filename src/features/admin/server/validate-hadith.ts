import { AdminHadithPayload, AdminIdentifierInput, AdminNarratorInput } from "@/features/admin/types";

const asNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export function validateHadithPayload(raw: unknown): { data?: AdminHadithPayload; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { errors: ["Request body must be an object"] };
  }

  const body = raw as Record<string, unknown>;
  const hadithNumber = asNumber(body.hadithNumber);
  const matn = typeof body.matn === "string" ? body.matn.trim() : "";
  const sourceId = asNumber(body.sourceId);
  const sourceName = typeof body.sourceName === "string" ? body.sourceName.trim() : "";
  const authorName = typeof body.authorName === "string" ? body.authorName.trim() || undefined : undefined;
  const authorLifespan =
    typeof body.authorLifespan === "string" ? body.authorLifespan.trim() || null : body.authorLifespan == null ? null : undefined;

  if (!hadithNumber) errors.push("hadithNumber is required and must be a number");
  if (!matn) errors.push("matn is required");
  if (!sourceId && !sourceName) errors.push("Provide either sourceId or sourceName");

  const narrators = parseNarrators(body.narrators);
  const identifiers = parseIdentifiers(body.identifiers);

  const data: AdminHadithPayload = {
    hadithNumber: hadithNumber ?? 0,
    displayNumber: typeof body.displayNumber === "string" ? body.displayNumber.trim() || null : null,
    matn,
    sanad: typeof body.sanad === "string" ? body.sanad.trim() || null : null,
    location: typeof body.location === "string" ? body.location.trim() || null : null,
    sourceId,
    sourceName: sourceName || undefined,
    authorName,
    authorLifespan,
    bookId: asNumber(body.bookId),
    bookName: typeof body.bookName === "string" ? body.bookName.trim() || undefined : undefined,
    bookNumber: asNumber(body.bookNumber),
    chapterId: asNumber(body.chapterId),
    chapterName: typeof body.chapterName === "string" ? body.chapterName.trim() || undefined : undefined,
    chapterNumber: asNumber(body.chapterNumber),
    narrationLevelId: asNumber(body.narrationLevelId),
    chainTypeId: asNumber(body.chainTypeId),
    attributionTypeId: asNumber(body.attributionTypeId),
    gradeId: asNumber(body.gradeId),
    grades: Array.isArray(body.grades) ? (body.grades as AdminHadithPayload["grades"]) : undefined,
    narrators,
    identifiers,
    tags: parseTags(body.tags),
  };

  return { data, errors };
}

function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function parseNarrators(raw: unknown): AdminNarratorInput[] {
  if (!Array.isArray(raw)) return [];
  const parsed: AdminNarratorInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;
    parsed.push({
      name,
      descriptor: typeof record.descriptor === "string" ? record.descriptor.trim() || null : null,
      role: record.role === "prophet" ? "prophet" : "narrator",
      classificationId: asNumber(record.classificationId),
      reliabilityId: asNumber(record.reliabilityId),
      transmissionMethodId: asNumber(record.transmissionMethodId),
    });
  }
  return parsed;
}

function parseIdentifiers(raw: unknown): AdminIdentifierInput[] {
  if (!Array.isArray(raw)) return [];
  const parsed: AdminIdentifierInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const schemeKey = typeof record.schemeKey === "string" ? record.schemeKey.trim() : "";
    const identifier = typeof record.identifier === "string" ? record.identifier.trim() : "";
    if (!schemeKey || !identifier) continue;
    parsed.push({
      schemeKey,
      identifier,
      notes: typeof record.notes === "string" ? record.notes.trim() || null : null,
      isPrimary: Boolean(record.isPrimary),
    });
  }
  return parsed;
}
