// Mark server-only in Next.js; ignore when running standalone scripts (tsx/node).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop for script contexts */
}
import fs from "node:fs/promises";
import path from "node:path";
import type { EvaluationQueryConfig } from "@/types/evaluation";

const DEFAULT_DATASET_PATH = process.env.EVAL_DATASET_PATH ?? path.join(process.cwd(), "evaluation", "eval-set.json");

export type LoadedEvaluationDataset = {
  path: string;
  queries: EvaluationQueryConfig[];
  missing: boolean;
  warnings: string[];
};

function normalizeFilters(raw: unknown) {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const asNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  };
  const asNumberArray = (value: unknown) => {
    if (!Array.isArray(value)) return undefined;
    const unique = Array.from(new Set(value.map((item) => Number(item)).filter((n) => Number.isFinite(n))));
    return unique.length ? unique : undefined;
  };
  const filters = {
    sourceId: asNumber(data.sourceId),
    bookId: asNumber(data.bookId),
    chapterId: asNumber(data.chapterId),
    tagIds: asNumberArray(data.tagIds),
    gradeIds: asNumberArray(data.gradeIds),
    scholarIds: asNumberArray(data.scholarIds),
  };
  if (
    filters.sourceId === undefined &&
    filters.bookId === undefined &&
    filters.chapterId === undefined &&
    !filters.tagIds &&
    !filters.gradeIds &&
    !filters.scholarIds
  ) {
    return undefined;
  }
  return filters;
}

function normalizeQuery(raw: unknown, idx: number, warnings: string[]): EvaluationQueryConfig | null {
  if (!raw || typeof raw !== "object") {
    warnings.push(`Entry ${idx + 1} is not an object and was skipped.`);
    return null;
  }
  const data = raw as Record<string, unknown>;
  const idRaw = typeof data.id === "string" ? data.id.trim() : "";
  const id = idRaw || `query-${idx + 1}`;
  const question = typeof data.question === "string" ? data.question.trim() : "";
  if (!question) {
    warnings.push(`Query ${id} is missing a question.`);
    return null;
  }
  const relevantRaw = Array.isArray(data.relevantHadithIds) ? data.relevantHadithIds : [];
  const relevant = Array.from(new Set(relevantRaw.map((value) => Number(value)).filter((num) => Number.isFinite(num))));
  if (!relevant.length) {
    warnings.push(`Query ${id} does not declare any relevantHadithIds.`);
  }
  const filters = normalizeFilters(data.filters);
  const notes = typeof data.notes === "string" ? data.notes.trim() : undefined;
  return {
    id,
    question,
    relevantHadithIds: relevant,
    filters,
    notes,
  };
}

export async function loadEvaluationDataset(customPath?: string): Promise<LoadedEvaluationDataset> {
  const datasetPath = customPath ?? DEFAULT_DATASET_PATH;
  const warnings: string[] = [];
  try {
    const raw = await fs.readFile(datasetPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Evaluation dataset must be a JSON array.");
    }
    const queries = parsed
      .map((entry, idx) => normalizeQuery(entry, idx, warnings))
      .filter((query): query is EvaluationQueryConfig => Boolean(query));
    return {
      path: datasetPath,
      queries,
      missing: false,
      warnings,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      warnings.push(`Evaluation dataset not found at ${datasetPath}.`);
      return {
        path: datasetPath,
        queries: [],
        missing: true,
        warnings,
      };
    }
    throw new Error(`[evaluation] Unable to load dataset (${datasetPath}): ${(error as Error).message}`);
  }
}
