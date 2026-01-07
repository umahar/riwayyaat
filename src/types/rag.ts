import type { GraphApiEdge, GraphApiNode } from "@/server/graph/types";

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
  similarity: number; // combined retrieval score (higher is more similar)
  retrieval?: {
    vectorScore?: number;
    graphScore?: number;
    denseScore?: number;
    combinedScore?: number;
  };
};

export type RagCitation = {
  hadithId: number;
  displayNumber: string | null;
  source: string;
};

export type RagGraph = {
  nodes: GraphApiNode[];
  edges: GraphApiEdge[];
};

export type RagContextEntry = {
  hadithId: number;
  displayNumber: string | null;
  source: string;
  book?: string | null;
  chapter?: string | null;
  matn: string;
  tags: string[];
  grades: Array<{ gradeTitle: string; scholar: string; isPrimary?: boolean }>;
  extra?: {
    displayLabel?: string;
    location?: string;
    grading?: string;
    author?: { name: string; lifespan?: string };
    identifiers?: Array<{ schemeKey: string; identifier: string; isPrimary?: boolean }>;
    chain?: Array<{
      name: string;
      descriptor?: string;
      lifespan?: string;
      type?: "prophet";
      reliability?: string;
    }>;
    narrationLevel?: string;
    chainTypes?: string[];
    sourceTypes?: string[];
  };
  graph?: {
    chain?: string[];
    variants?: Array<{ hadithId: number; source: string; displayNumber: string; reason: string }>;
  };
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
