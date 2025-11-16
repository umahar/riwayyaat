import { AdminHadithPayload, AdminIdentifierInput, AdminNarratorInput } from "@/features/admin/types";

const asNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeIdInput = (value: unknown) => {
  const num = asNumber(value);
  if (!num || num <= 0) return null;
  return num;
};

export function validateHadithPayload(raw: unknown): { data?: AdminHadithPayload; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { errors: ["Request body must be an object"] };
  }

  const body = raw as Record<string, unknown>;
  const hadithNumber = asNumber(body.hadithNumber);
  const matn = typeof body.matn === "string" ? body.matn.trim() : "";
  const sourceId = normalizeIdInput(body.sourceId);

  if (!hadithNumber) errors.push("hadithNumber is required and must be a number");
  if (!matn) errors.push("matn is required");
  if (!sourceId) errors.push("Select a source");

  const narrators = parseNarrators(body.narrators);
  const identifiers = parseIdentifiers(body.identifiers);

  const data: AdminHadithPayload = {
    hadithNumber: hadithNumber ?? 0,
    displayNumber: typeof body.displayNumber === "string" ? body.displayNumber.trim() || null : null,
    matn,
    sanad: typeof body.sanad === "string" ? body.sanad.trim() || null : null,
    location: typeof body.location === "string" ? body.location.trim() || null : null,
    sourceId: sourceId ?? 0,
    bookId: normalizeIdInput(body.bookId),
    chapterId: normalizeIdInput(body.chapterId),
    narrationLevelId: normalizeIdInput(body.narrationLevelId),
    chainTypeId: normalizeIdInput(body.chainTypeId),
    attributionTypeId: normalizeIdInput(body.attributionTypeId),
    gradeId: normalizeIdInput(body.gradeId),
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
      classificationId: normalizeIdInput(record.classificationId),
      reliabilityId: normalizeIdInput(record.reliabilityId),
      transmissionMethodId: normalizeIdInput(record.transmissionMethodId),
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
