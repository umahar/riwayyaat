import type { RagCitation, RagFilters } from "@/types/rag";

export type EvaluationQueryConfig = {
  id: string;
  question: string;
  relevantHadithIds: number[];
  filters?: RagFilters;
  notes?: string;
};

export type EvaluationQueryMetrics = {
  precisionAt5: number | null;
  recallAt20: number | null;
  reciprocalRank: number | null;
  citationFaithfulness: number | null;
  answerFaithfulness: number | null;
};

export type EvaluationRetrievedHit = {
  rank: number;
  hadithId: number;
  displayNumber: string | null;
  source: string;
  similarity: number | null;
  relevant: boolean;
};

export type EvaluationAnswerSummary = {
  text: string;
  citations: RagCitation[];
};

export type QueryKgCoverage = {
  hadithCount: number;
  overallPercent: number;
  isnadPercent: number;
};

export type KgSlotBreakdown = {
  key: string;
  label: string;
  filled: number;
  total: number;
  percentage: number;
};

export type KgCoverageSummary = {
  hadithCount: number;
  overallPercent: number;
  isnadPercent: number;
  slots: KgSlotBreakdown[];
};

export type EvaluationQueryRun = {
  id: string;
  question: string;
  notes?: string;
  relevantHadithIds: number[];
  filters?: RagFilters;
  metrics: EvaluationQueryMetrics;
  retrieved: EvaluationRetrievedHit[];
  answer?: EvaluationAnswerSummary;
  kgCoverage?: QueryKgCoverage;
  warnings?: string[];
  error?: string;
};

export type EvaluationMetricSummary = {
  precisionAt5: number | null;
  recallAt20: number | null;
  mrr: number | null;
  citationFaithfulness: number | null;
  answerFaithfulness: number | null;
  kgCompletenessOverall: number | null;
  kgCompletenessIsnad: number | null;
};

export type EvaluationRunSummary = {
  datasetPath: string;
  datasetSize: number;
  startedAt: string;
  completedAt: string;
  metrics: EvaluationMetricSummary;
  queries: EvaluationQueryRun[];
  kgCoverage: KgCoverageSummary;
  warnings: string[];
};
