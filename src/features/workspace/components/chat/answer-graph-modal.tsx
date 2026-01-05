"use client";

import { useEffect, useState } from "react";
import { useGraph } from "@/features/workspace/hooks/use-graph";
import { ChainGraph } from "@/features/workspace/components/graph/chain-graph";
import { VariantGraph } from "@/features/workspace/components/graph/variant-graph";
import { LoadingState } from "@/components/ui/state/loading-state";
import { ErrorState } from "@/components/ui/state/error-state";

type GraphModalProps = {
  hadithId: number | null;
  open: boolean;
  onClose: () => void;
};

type GraphTab = "chain" | "variants";

export function AnswerGraphModal({ hadithId, open, onClose }: GraphModalProps) {
  const [activeTab, setActiveTab] = useState<GraphTab>("chain");
  const { chain, variants, loading, error, loadChainGraph, loadVariants, resetVariants } = useGraph();

  useEffect(() => {
    if (!open || !hadithId) return;
    setActiveTab("chain");
    resetVariants();
    loadChainGraph(hadithId);
  }, [open, hadithId, loadChainGraph, resetVariants]);

  useEffect(() => {
    if (!open || !hadithId) return;
    if (activeTab === "variants" && !variants) {
      loadVariants(hadithId);
    }
  }, [activeTab, hadithId, open, loadVariants, variants]);

  if (!open || !hadithId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-card)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--border-soft)] px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Hadith graph view</h3>
            <p className="text-xs text-[var(--text-muted)]">Chain and variants from the knowledge graph.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition hover:-translate-y-0.5"
          >
            Close
          </button>
        </header>
        <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-6 py-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("chain")}
            className={`rounded-full px-4 py-1 ${
              activeTab === "chain"
                ? "bg-[var(--accent-emerald)] text-[var(--accent-contrast)]"
                : "bg-[var(--surface-card)] text-[var(--text-secondary)]"
            }`}
          >
            Chain
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("variants")}
            className={`rounded-full px-4 py-1 ${
              activeTab === "variants"
                ? "bg-[var(--accent-emerald)] text-[var(--accent-contrast)]"
                : "bg-[var(--surface-card)] text-[var(--text-secondary)]"
            }`}
          >
            Variants
          </button>
        </div>
        <div className="px-6 py-5">
          {error && <ErrorState message={error} />}
          {loading && <LoadingState message="Loading graph…" />}
          {!loading && !error && activeTab === "chain" && chain && <ChainGraph data={chain} />}
          {!loading && !error && activeTab === "variants" && variants && <VariantGraph data={variants} />}
          {!loading && !error && activeTab === "chain" && !chain && (
            <p className="text-sm text-[var(--text-muted)]">No chain data available.</p>
          )}
          {!loading && !error && activeTab === "variants" && !variants && (
            <p className="text-sm text-[var(--text-muted)]">No variants available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
