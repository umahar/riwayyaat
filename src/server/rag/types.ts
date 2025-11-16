export type RagFilters = {
  sourceId?: number;
  bookId?: number;
  chapterId?: number;
  tagIds?: number[];
  gradeIds?: number[];
  scholarIds?: number[];
};

export type RagRetrievalParams = {
  question: string;
  limit?: number;
  model?: string;
} & RagFilters;

export type RagResult = {
  hadithId: number;
  displayNumber: string | null;
  displayLabel: string | null;
  source: { id: number; name: string };
  book?: { id: number | null; name: string | null; number: number | null };
  chapter?: { id: number | null; name: string | null; number: number | null };
  matn: string;
  tags: string[];
  grades: Array<{
    grade: { id: number; title: string; description: string | null; backgroundColor: string | null; textColor: string | null };
    scholar: { id: number; name: string; lifespan: string | null };
    isPrimary: boolean | null;
  }>;
  similarity: number; // cosine similarity (higher is more similar)
};

export type RagCitation = {
  hadithId: number;
  displayNumber: string | null;
  source: string;
};

export type RagAnswer = {
  answer: string;
  citations: RagCitation[];
  modelUsed?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};
