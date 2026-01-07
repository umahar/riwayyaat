"use client";

import { useState } from "react";
import Link from "next/link";
import type { EvaluationRunSummary } from "@/types/evaluation";

type RunOptions = {
  limit: string;
  topK: string;
  skipAnswers: boolean;
  retrievalMode: "kg" | "pg" | "hybrid";
};

const DEFAULT_OPTIONS: RunOptions = {
  limit: "",
  topK: "20",
  skipAnswers: false,
  retrievalMode: "kg",
};

function formatDecimal(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return value.toFixed(digits);
}

function formatPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(digits)}%`;
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] p-4 shadow-sm">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-subtle)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      {helper && <p className="mt-1 text-xs text-[var(--text-muted)]">{helper}</p>}
    </div>
  );
}

function QueryCard({ index, query }: { index: number; query: EvaluationRunSummary["queries"][number] }) {
  return (
    <details className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-4 transition hover:border-[var(--text-primary)]" open={false}>
      <summary className="flex cursor-pointer flex-col gap-1">
        <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>
            #{index + 1} · {query.id}
          </span>
          {query.kgCoverage && (
            <span>
              KG {formatPercent(query.kgCoverage.overallPercent)} / isnād {formatPercent(query.kgCoverage.isnadPercent)}
            </span>
          )}
        </div>
        <p className="text-base font-semibold text-[var(--text-primary)]">{query.question}</p>
      </summary>
      <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)]">
        <p>
          Precision@5 {formatDecimal(query.metrics.precisionAt5)} · Recall@20 {formatDecimal(query.metrics.recallAt20)} · MRR{" "}
          {formatDecimal(query.metrics.reciprocalRank)}
        </p>
        <p>
          Citation faithfulness {formatDecimal(query.metrics.citationFaithfulness)} · Answer faithfulness{" "}
          {formatDecimal(query.metrics.answerFaithfulness)}
        </p>
        {query.warnings?.length && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {query.warnings.map((warning) => (
              <div key={warning}>⚠ {warning}</div>
            ))}
          </div>
        )}
        {query.error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">Error: {query.error}</div>
        )}
        {query.answer && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Answer citations</p>
            <p className="text-sm text-[var(--text-primary)]">
              {query.answer.citations.length
                ? query.answer.citations.map((citation) => `${citation.source} ${citation.displayNumber ?? `#${citation.hadithId}`}`).join(", ")
                : "No citations returned"}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Top retrieval hits</p>
          <div className="mt-1 flex flex-col gap-1 text-sm text-[var(--text-primary)]">
            {query.retrieved.length === 0 && <p className="text-[var(--text-muted)]">None retrieved</p>}
            {query.retrieved.slice(0, 8).map((hit) => (
              <div key={`${query.id}-${hit.rank}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-soft)] px-2 py-1">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{hit.rank}.</span>
                <span>{hit.displayNumber ?? `#${hit.hadithId}`}</span>
                <span className="text-[var(--text-muted)]">· {hit.source}</span>
                <span className="text-[var(--text-muted)]">· score {hit.similarity == null ? "n/a" : hit.similarity.toFixed(3)}</span>
                {hit.relevant && <span className="rounded-full bg-[var(--accent-emerald)] px-2 py-0.5 text-xs text-[var(--accent-contrast)]">relevant</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

export function EvaluationDashboard() {
  const [options, setOptions] = useState<RunOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<EvaluationRunSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runEvaluation() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await fetch("/api/admin/evaluation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: options.limit ? Number(options.limit) : undefined,
          topK: options.topK ? Number(options.topK) : undefined,
          skipAnswers: options.skipAnswers,
          retrievalMode: options.retrievalMode,
        }),
      });
      const body = (await payload.json().catch(() => ({}))) as { data?: EvaluationRunSummary; error?: string };
      if (!payload.ok || body.error) {
        throw new Error(body.error ?? `Request failed (${payload.status})`);
      }
      setResult(body.data ?? null);
    } catch (err) {
      console.error("[admin/eval] Failed to run evaluation", err);
      setError(err instanceof Error ? err.message : "Unable to run evaluation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-svh flex-col overflow-y-auto bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <header className="mb-6 flex flex-col gap-2 border-b border-[var(--border-soft)] pb-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-subtle)]">Admin</p>
          <h1 className="text-3xl font-semibold">Evaluation Runner</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Replay the pgvector → KG → answer pipeline for your curated evaluation set. Metrics line up with the IEEE paper (KG completeness, Precision@5,
            Recall@20, MRR, faithfulness).
          </p>
        </div>
        <Link
          href="/admin/hadith"
          className="w-fit rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm text-[var(--text-secondary)] transition hover:border-[var(--text-primary)]"
        >
          ← Back to Hadith Manager
        </Link>
        <p className="text-xs text-[var(--text-muted)]">
          Configure <code>evaluation/eval-set.json</code> (see docs/EVALUATION.md) so each demo run is reproducible.
        </p>
      </header>

      <section className="mb-6 grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-4 lg:grid-cols-[2fr,1fr]">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
            Query limit (blank runs all)
            <input
              type="number"
              min={1}
              value={options.limit}
              onChange={(event) => setOptions((prev) => ({ ...prev, limit: event.target.value }))}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
            Retrieval depth (top K hits)
            <input
              type="number"
              min={1}
              max={50}
              value={options.topK}
              onChange={(event) => setOptions((prev) => ({ ...prev, topK: event.target.value }))}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={options.skipAnswers}
              onChange={(event) => setOptions((prev) => ({ ...prev, skipAnswers: event.target.checked }))}
              className="h-4 w-4 rounded border border-[var(--border-soft)] accent-[var(--accent-emerald)]"
            />
            Skip answer generation (compute retrieval metrics only)
          </label>
          <div className="flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-subtle)]">Retrieval mode</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOptions((prev) => ({ ...prev, retrievalMode: "kg" }))}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  options.retrievalMode === "kg"
                    ? "bg-[var(--accent-emerald)] text-[var(--accent-contrast)]"
                    : "border border-[var(--border-soft)] text-[var(--text-secondary)]"
                }`}
              >
                KG (Neo4j)
              </button>
              <button
                type="button"
                onClick={() => setOptions((prev) => ({ ...prev, retrievalMode: "hybrid" }))}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  options.retrievalMode === "hybrid"
                    ? "bg-[var(--accent-emerald)] text-[var(--accent-contrast)]"
                    : "border border-[var(--border-soft)] text-[var(--text-secondary)]"
                }`}
              >
                Hybrid (KG + dense)
              </button>
              <button
                type="button"
                onClick={() => setOptions((prev) => ({ ...prev, retrievalMode: "pg" }))}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  options.retrievalMode === "pg"
                    ? "bg-[var(--accent-emerald)] text-[var(--accent-contrast)]"
                    : "border border-[var(--border-soft)] text-[var(--text-secondary)]"
                }`}
              >
                Postgres (pgvector)
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-secondary)]">
          <p>
            The run uses <code>evaluation/eval-set.json</code> by default. Override with <code>EVAL_DATASET_PATH</code> if you keep multiple scenarios.
          </p>
          <div className="flex flex-col gap-2">
            {loading && (
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-inner">
                <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent-emerald)] border-t-transparent" />
                Running evaluation… each query replays retrieval, KG, and answer scoring. This can take a minute for large datasets.
              </div>
            )}
            <button
              onClick={runEvaluation}
              disabled={loading}
              className="rounded-full bg-[var(--accent-emerald)] px-4 py-2 text-base font-semibold text-[var(--accent-contrast)] shadow-md transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading ? "Running…" : "Run evaluation"}
            </button>
          </div>
        </div>
      </section>

      {error && <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      {result && (
        <div className="grid gap-6">
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] p-4 text-sm text-[var(--text-secondary)]">
            <p>
              Dataset: <span className="text-[var(--text-primary)]">{result.datasetPath}</span>
            </p>
            <p>
              Entries in dataset: <strong>{result.datasetSize}</strong> · Queries executed: <strong>{result.queries.length}</strong>
            </p>
            <p>
              Started: {new Date(result.startedAt).toLocaleString()} · Completed: {new Date(result.completedAt).toLocaleString()}
            </p>
            {result.warnings.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {result.warnings.map((warning) => (
                  <div key={warning}>⚠ {warning}</div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="KG completeness (overall)" value={formatPercent(result.metrics.kgCompletenessOverall)} helper="Percent of KG slots populated" />
            <MetricCard label="KG completeness — isnād" value={formatPercent(result.metrics.kgCompletenessIsnad)} helper="Chain narrator coverage" />
            <MetricCard label="Precision@5" value={formatDecimal(result.metrics.precisionAt5)} helper="Relevant hits among top 5" />
            <MetricCard label="Recall@20" value={formatDecimal(result.metrics.recallAt20)} helper="Relevant hits recovered by top 20" />
            <MetricCard label="MRR" value={formatDecimal(result.metrics.mrr)} helper="Mean reciprocal rank" />
            <MetricCard label="Citation faithfulness" value={formatDecimal(result.metrics.citationFaithfulness)} helper="Relevant citations / total citations" />
            <MetricCard label="Answer-level faithfulness" value={formatDecimal(result.metrics.answerFaithfulness)} helper="1 if every citation is relevant" />
          </section>

          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] p-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">KG slot breakdown</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[var(--text-muted)]">
                  <tr>
                    <th className="py-2">Slot</th>
                    <th className="py-2">Coverage</th>
                    <th className="py-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {result.kgCoverage.slots.map((slot) => (
                    <tr key={slot.key} className="border-t border-[var(--border-soft)]">
                      <td className="py-2">{slot.label}</td>
                      <td className="py-2">{formatPercent(slot.percentage)}</td>
                      <td className="py-2 text-[var(--text-muted)]">
                        {slot.filled}/{slot.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Per-query breakdown</h2>
            {result.queries.length === 0 && (
              <p className="rounded-2xl border border-dashed border-[var(--border-soft)] px-4 py-6 text-sm text-[var(--text-muted)]">
                No queries were executed. Add entries to <code>evaluation/eval-set.json</code>.
              </p>
            )}
            {result.queries.map((query, index) => (
              <QueryCard key={query.id} index={index} query={query} />
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
