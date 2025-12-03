import "server-only";
import type {
  EvaluationAnswerSummary,
  EvaluationMetricSummary,
  EvaluationQueryMetrics,
  EvaluationQueryRun,
  EvaluationRunSummary,
} from "@/types/evaluation";
import type { RagResult } from "@/types/rag";
import { retrieveHadithForQuestion } from "@/server/rag/retriever";
import { generateRagAnswer } from "@/server/rag/generator";
import { loadEvaluationDataset } from "@/server/eval/dataset";
import { fetchHadithCoverage, summarizeCoverage, summarizeCoverageForQuery, HadithCoverageRow } from "@/server/eval/kg";

type RunEvaluationOptions = {
  datasetPath?: string;
  limit?: number;
  topK?: number;
  generateAnswers?: boolean;
  answerContextLimit?: number;
};

function emptyMetrics(): EvaluationQueryMetrics {
  return {
    precisionAt5: null,
    recallAt20: null,
    reciprocalRank: null,
    citationFaithfulness: null,
    answerFaithfulness: null,
  };
}

function computeQueryMetrics(results: RagResult[], relevantIds: number[], citations?: EvaluationAnswerSummary["citations"]) {
  const metrics = emptyMetrics();
  const relevantSet = new Set(relevantIds);
  if (relevantSet.size === 0) return metrics;

  const precisionK = 5;
  const top5 = results.slice(0, precisionK);
  const hitsAt5 = top5.filter((item) => relevantSet.has(item.hadithId)).length;
  metrics.precisionAt5 = precisionK ? hitsAt5 / precisionK : 0;

  const top20 = results.slice(0, 20);
  const hitsAt20 = top20.filter((item) => relevantSet.has(item.hadithId)).length;
  metrics.recallAt20 = relevantSet.size ? hitsAt20 / relevantSet.size : 0;

  const firstRelevantIndex = results.findIndex((item) => relevantSet.has(item.hadithId));
  metrics.reciprocalRank = firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1);

  if (citations === undefined) {
    metrics.citationFaithfulness = null;
    metrics.answerFaithfulness = null;
  } else if (citations.length === 0) {
    metrics.citationFaithfulness = 0;
    metrics.answerFaithfulness = 0;
  } else {
    const faithful = citations.filter((citation) => relevantSet.has(citation.hadithId)).length;
    metrics.citationFaithfulness = citations.length ? faithful / citations.length : 0;
    metrics.answerFaithfulness = faithful === citations.length ? 1 : 0;
  }

  return metrics;
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  const total = valid.reduce((sum, value) => sum + value, 0);
  return total / valid.length;
}

function mapResultToHit(result: RagResult, rank: number, relevantIds: Set<number>) {
  return {
    rank,
    hadithId: result.hadithId,
    displayNumber: result.displayNumber ?? result.displayLabel ?? null,
    source: result.source.name,
    similarity: typeof result.similarity === "number" ? Number(result.similarity) : null,
    relevant: relevantIds.has(result.hadithId),
  };
}

export async function runEvaluation(options: RunEvaluationOptions = {}): Promise<EvaluationRunSummary> {
  const startedAt = new Date();
  const dataset = await loadEvaluationDataset(options.datasetPath);
  const warnings = [...dataset.warnings];
  const limit = options.limit && options.limit > 0 ? Math.trunc(options.limit) : dataset.queries.length;
  const topK = options.topK && options.topK > 0 ? Math.min(Math.trunc(options.topK), 50) : 20;
  const answerContextLimit =
    options.answerContextLimit && options.answerContextLimit > 0 ? Math.min(Math.trunc(options.answerContextLimit), topK) : Math.min(8, topK);
  const generateAnswers = options.generateAnswers !== false;

  const selectedQueries = dataset.queries.slice(0, limit);
  const perQueryHadithIds = new Map<string, Set<number>>();
  const queryResults: EvaluationQueryRun[] = [];

  let answersEnabled = generateAnswers;
  for (const queryConfig of selectedQueries) {
    const relevantSet = new Set(queryConfig.relevantHadithIds);
    const perQueryWarnings: string[] = [];
    if (!queryConfig.relevantHadithIds.length) {
      perQueryWarnings.push("No relevantHadithIds defined for this query.");
    }
    const coverageSet = new Set<number>(queryConfig.relevantHadithIds);
    perQueryHadithIds.set(queryConfig.id, coverageSet);
    try {
      const retrieved = await retrieveHadithForQuestion({
        question: queryConfig.question,
        limit: topK,
        ...queryConfig.filters,
      });
      retrieved.forEach((row) => coverageSet.add(row.hadithId));

      let answerSummary: EvaluationAnswerSummary | undefined;
      if (answersEnabled && retrieved.length) {
        try {
          const context = retrieved.slice(0, answerContextLimit);
          const answer = await generateRagAnswer({ question: queryConfig.question, results: context });
          answerSummary = { text: answer.answer, citations: answer.citations };
        } catch (error) {
          answersEnabled = false;
          const message = error instanceof Error ? error.message : "Failed to generate answer";
          warnings.push(`[LLM] Disabled answer generation after error for ${queryConfig.id}: ${message}`);
        }
      }

      const metrics = computeQueryMetrics(retrieved, queryConfig.relevantHadithIds, answerSummary?.citations);
      queryResults.push({
        id: queryConfig.id,
        question: queryConfig.question,
        notes: queryConfig.notes,
        relevantHadithIds: queryConfig.relevantHadithIds,
        filters: queryConfig.filters,
        metrics,
        retrieved: retrieved.map((row, index) => mapResultToHit(row, index + 1, relevantSet)),
        answer: answerSummary,
        warnings: perQueryWarnings.length ? perQueryWarnings : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      warnings.push(`[query ${queryConfig.id}] ${message}`);
      queryResults.push({
        id: queryConfig.id,
        question: queryConfig.question,
        notes: queryConfig.notes,
        relevantHadithIds: queryConfig.relevantHadithIds,
        filters: queryConfig.filters,
        metrics: emptyMetrics(),
        retrieved: [],
        error: message,
        warnings: perQueryWarnings.length ? perQueryWarnings : undefined,
      });
    }
  }

  const coverageIds = Array.from(perQueryHadithIds.values()).flatMap((set) => Array.from(set));
  const uniqueCoverageIds = Array.from(new Set(coverageIds));
  const coverageRows = uniqueCoverageIds.length ? await fetchHadithCoverage(uniqueCoverageIds) : [];
  const coverageMap = new Map<number, HadithCoverageRow>(coverageRows.map((row) => [row.hadithId, row]));

  for (const query of queryResults) {
    const coverageSet = perQueryHadithIds.get(query.id);
    if (!coverageSet || !coverageSet.size) continue;
    const rows = Array.from(coverageSet)
      .map((id) => coverageMap.get(id))
      .filter((row): row is HadithCoverageRow => Boolean(row));
    const summary = summarizeCoverageForQuery(rows);
    if (summary) query.kgCoverage = summary;
  }

  const datasetCoverage = summarizeCoverage(coverageRows);

  const metricsSummary: EvaluationMetricSummary = {
    precisionAt5: average(queryResults.map((result) => result.metrics.precisionAt5)),
    recallAt20: average(queryResults.map((result) => result.metrics.recallAt20)),
    mrr: average(queryResults.map((result) => result.metrics.reciprocalRank)),
    citationFaithfulness: average(queryResults.map((result) => result.metrics.citationFaithfulness)),
    answerFaithfulness: average(queryResults.map((result) => result.metrics.answerFaithfulness)),
    kgCompletenessOverall: datasetCoverage.hadithCount ? datasetCoverage.overallPercent : null,
    kgCompletenessIsnad: datasetCoverage.hadithCount ? datasetCoverage.isnadPercent : null,
  };

  const completedAt = new Date();
  return {
    datasetPath: dataset.path,
    datasetSize: dataset.queries.length,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    metrics: metricsSummary,
    queries: queryResults,
    kgCoverage: datasetCoverage,
    warnings,
  };
}
