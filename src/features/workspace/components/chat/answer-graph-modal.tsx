"use client";

import { AnswerRelatedGraph } from "@/features/workspace/components/graph/answer-related-graph";
import { GraphData } from "@/features/workspace/hooks/use-graph";

type GraphModalProps = {
  graph: GraphData | null;
  open: boolean;
  onClose: () => void;
};

export function AnswerGraphModal({ graph, open, onClose }: GraphModalProps) {
  if (!open || !graph) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-panel)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close graph"
          className="absolute right-4 top-4 rounded-full border border-[var(--border-soft)] bg-[var(--surface-popover)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] shadow-sm transition hover:-translate-y-0.5"
        >
          ✕
        </button>
        <header className="flex items-center justify-between border-b border-[var(--border-soft)] px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Related knowledge graph</h3>
            <p className="text-xs text-[var(--text-muted)]">Relationships used to answer this question.</p>
          </div>
        </header>
        <div className="px-6 py-5">
          <AnswerRelatedGraph data={graph} />
        </div>
      </div>
    </div>
  );
}
