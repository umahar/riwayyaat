export type AdminNarratorInput = {
  name: string;
  descriptor?: string | null;
  role?: "prophet" | "narrator";
  classificationId?: number | null;
  reliabilityId?: number | null;
  transmissionMethodId?: number | null;
};

export type AdminIdentifierInput = {
  schemeKey: string;
  identifier: string;
  notes?: string | null;
  isPrimary?: boolean | null;
};

export type AdminGradeInput = {
  gradeId?: number | null;
  gradeTitle?: string | null;
  scholarId?: number | null;
  scholarName?: string | null;
  scholarLifespan?: string | null;
  isPrimary?: boolean | null;
};

export type AdminHadithPayload = {
  sourceId: number;
  bookId?: number | null;
  chapterId?: number | null;
  hadithNumber: number;
  displayNumber?: string | null;
  matn: string;
  sanad?: string | null;
  location?: string | null;
  narrationLevelId?: number | null;
  chainTypeId?: number | null;
  attributionTypeId?: number | null;
  gradeId?: number | null;
  grades?: AdminGradeInput[];
  narrators?: AdminNarratorInput[];
  tags?: string[];
  identifiers?: AdminIdentifierInput[];
};

export type AdminHadithSummary = {
  id: number;
  displayNumber: string;
  hadithNumber: number;
  source: string;
  book?: string | null;
  chapter?: string | null;
  tags: string[];
  matnPreview: string;
};

export type AdminHadithDetail = {
  id: number;
  hadithNumber: number;
  displayNumber: string;
  sourceId: number;
  source: string;
  bookId: number | null;
  book: string | null;
  bookNumber: number | null;
  chapterId: number | null;
  chapter: string | null;
  chapterNumber: number | null;
  matn: string;
  sanad: string | null;
  location: string | null;
  narrationLevelId: number | null;
  chainTypeId: number | null;
  attributionTypeId: number | null;
  narrators: AdminNarratorInput[];
  tags: string[];
  identifiers: AdminIdentifierInput[];
  grades: AdminGradeInput[];
};

export type LookupOption = {
  id: number;
  label: string;
  secondary?: string | null;
};

export type BookLookup = LookupOption & { sourceId: number; number?: number | null };
export type ChapterLookup = LookupOption & { bookId: number; number?: number | null };

export type AdminLookups = {
  sources: LookupOption[];
  books: BookLookup[];
  chapters: ChapterLookup[];
  narrationLevels: LookupOption[];
  chainTypes: LookupOption[];
  attributionTypes: LookupOption[];
  grades: LookupOption[];
  scholars: LookupOption[];
  tags: LookupOption[];
  authors: LookupOption[];
  narratorTiers: LookupOption[];
  reliabilityTiers: LookupOption[];
  transmissionMethods: LookupOption[];
};
