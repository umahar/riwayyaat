import "dotenv/config";
import process from "node:process";
import { runEvaluation } from "@/server/eval/runner";
import type { EvaluationQueryRun } from "@/types/evaluation";

type CliOptions = {
  limit?: number;
  topK?: number;
  datasetPath?: string;
  skipAnswers?: boolean;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {};
  for (const arg of process.argv.slice(2)) {
    if (arg === "--skip-answers") {
      options.skipAnswers = true;
      continue;
    }
    const [flag, value] = arg.split("=");
    if (!value) continue;
    const numeric = Number(value);
    if (flag === "--limit" && Number.isFinite(numeric)) {
      options.limit = Math.trunc(numeric);
    } else if ((flag === "--topK" || flag === "--topk") && Number.isFinite(numeric)) {
      options.topK = Math.trunc(numeric);
    } else if (flag === "--dataset") {
      options.datasetPath = value;
    }
  }
  return options;
}

function formatDecimal(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return value.toFixed(digits);
}

function formatPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(digits)}%`;
}

function printQuery(index: number, query: EvaluationQueryRun) {
  console.log(`\n[${index + 1}] ${query.id} — ${query.question}`);
  if (query.notes) console.log(`    Notes: ${query.notes}`);
  if (query.error) console.log(`    Error: ${query.error}`);
  console.log(
    `    Precision@5: ${formatDecimal(query.metrics.precisionAt5)} | Recall@20: ${formatDecimal(query.metrics.recallAt20)} | MRR: ${formatDecimal(query.metrics.reciprocalRank)}`,
  );
  console.log(
    `    Citation faithfulness: ${formatDecimal(query.metrics.citationFaithfulness)} | Answer faithfulness: ${formatDecimal(query.metrics.answerFaithfulness)}`,
  );
  if (query.kgCoverage) {
    console.log(
      `    KG coverage: ${formatPercent(query.kgCoverage.overallPercent)} overall · ${formatPercent(query.kgCoverage.isnadPercent)} isnād (${query.kgCoverage.hadithCount} hadith)`,
    );
  } else {
    console.log("    KG coverage: n/a");
  }
  if (query.retrieved.length) {
    console.log("    Top hits:");
    query.retrieved.slice(0, 10).forEach((hit) => {
      const label = hit.displayNumber ?? `#${hit.hadithId}`;
      const similarity = hit.similarity == null ? "n/a" : hit.similarity.toFixed(3);
      console.log(`      ${hit.rank}. ${label} · ${hit.source} · score=${similarity} ${hit.relevant ? "★" : ""}`);
    });
  } else {
    console.log("    Top hits: none retrieved");
  }
  if (query.answer) {
    const citations = query.answer.citations.length
      ? query.answer.citations.map((c) => `${c.source} ${c.displayNumber ?? `#${c.hadithId}`}`).join(", ")
      : "none";
    console.log(`    Answer citations: ${citations}`);
  }
  if (query.warnings?.length) {
    query.warnings.forEach((warning) => console.log(`    ⚠ ${warning}`));
  }
}

async function main() {
  const args = parseArgs();
  const summary = await runEvaluation({
    limit: args.limit,
    topK: args.topK,
    datasetPath: args.datasetPath,
    generateAnswers: args.skipAnswers ? false : undefined,
  });

  console.log("=== Evaluation Summary ===");
  console.log(`Dataset file: ${summary.datasetPath}`);
  console.log(`Queries in dataset: ${summary.datasetSize}`);
  console.log(`Queries executed: ${summary.queries.length}`);
  console.log(`Started at: ${summary.startedAt}`);
  console.log(`Completed at: ${summary.completedAt}`);
  if (summary.warnings.length) {
    console.log("\nWarnings:");
    summary.warnings.forEach((warning) => console.log(`  • ${warning}`));
  }

  console.log("\nMetrics:");
  console.log(`  KG completeness (overall): ${formatPercent(summary.metrics.kgCompletenessOverall)}`);
  console.log(`  KG completeness — isnād level: ${formatPercent(summary.metrics.kgCompletenessIsnad)}`);
  console.log(`  Precision@5: ${formatDecimal(summary.metrics.precisionAt5)}`);
  console.log(`  Recall@20: ${formatDecimal(summary.metrics.recallAt20)}`);
  console.log(`  MRR: ${formatDecimal(summary.metrics.mrr)}`);
  console.log(`  Citation faithfulness: ${formatDecimal(summary.metrics.citationFaithfulness)}`);
  console.log(`  Answer-level faithfulness: ${formatDecimal(summary.metrics.answerFaithfulness)}`);

  console.log("\nKG slot breakdown:");
  summary.kgCoverage.slots.forEach((slot) => {
    console.log(`  ${slot.label}: ${formatPercent(slot.percentage)} (${slot.filled}/${slot.total})`);
  });

  if (!summary.queries.length) {
    console.log("\nNo queries were executed. Add entries to evaluation/eval-set.json.");
    return;
  }

  console.log("\nPer-query details:");
  summary.queries.forEach((query, index) => printQuery(index, query));
}

main().catch((error) => {
  console.error("[eval] Failed to run evaluation", error);
  process.exit(1);
});
