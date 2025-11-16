"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { Tag } from "@/components/ui/tag";
import { formatGradingLabel } from "@/features/hadith/taxonomy";
import { GradeAttribution, HadithInsight } from "@/features/hadith/types";
import { workspaceCopy } from "@/content/text";
import { LoadingState } from "@/components/ui/state/loading-state";
import { ErrorState } from "@/components/ui/state/error-state";
import { EmptyState } from "@/components/ui/state/empty-state";
import { NarratorChain } from "./narrator-chain";
import { useGraph } from "@/features/workspace/hooks/use-graph";
import { ChainGraph } from "@/features/workspace/components/graph/chain-graph";
import { VariantGraph } from "@/features/workspace/components/graph/variant-graph";
import { NarratorNetworkGraph } from "@/features/workspace/components/graph/narrator-network-graph";

type HadithDetailsPanelProps = {
  hadith: HadithInsight | null;
  isDesktop: boolean;
  onResizeStart?: (event: React.MouseEvent) => void;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
};

export function HadithDetailsPanel({
  hadith,
  isDesktop,
  onResizeStart,
  loading,
  error,
  onRetry,
}: HadithDetailsPanelProps) {
  const [isNarrationDetailsOpen, setIsNarrationDetailsOpen] = useState(false);
  const detailsCopy = workspaceCopy.details;
  const sidebarCopy = workspaceCopy.sidebar;

  const [graderSelection, setGraderSelection] = useState<{ hadithId: string | null; index: number }>({
    hadithId: null,
    index: 0,
  });
  const [gradeDetailState, setGradeDetailState] = useState<{ hadithId: string | null; open: boolean }>({
    hadithId: null,
    open: false,
  });
  const [activeTab, setActiveTab] = useState<"details" | "graph">(() => {
    if (typeof window === "undefined") return "details";
    const saved = localStorage.getItem("hadith-details-active-tab");
    return saved === "graph" ? "graph" : "details";
  });
  const {
    chain,
    variants,
    network,
    loading: graphLoading,
    error: graphError,
    loadChainGraph,
    loadVariants,
    loadNarratorNetwork,
    resetNetwork,
    resetVariants,
  } = useGraph();

  const gradeOptions = useMemo(() => {
    if (!hadith) return [] as Array<GradeAttribution & { scholarLabel: string; isPrimary: boolean }>;
    const options: Array<GradeAttribution & { scholarLabel: string; isPrimary: boolean }> =
      hadith.gradedGrades?.map((entry) => ({
        scholarLabel: entry.scholar.lifespan ? `${entry.scholar.name} (${entry.scholar.lifespan})` : entry.scholar.name,
        scholar: entry.scholar,
        grade: entry.grade,
        isPrimary: entry.isPrimary ?? entry.scholar.isPrimary ?? false,
      })) ?? [];

    if (options.length === 0) {
      const fallbackScholar =
        hadith.gradedBy && hadith.gradedBy.length
          ? hadith.gradedBy[0]
          : hadith.details.author
            ? { name: hadith.details.author.name, lifespan: hadith.details.author.lifespan }
            : null;
      options.push({
        scholarLabel: fallbackScholar
          ? fallbackScholar.lifespan
            ? `${fallbackScholar.name} (${fallbackScholar.lifespan})`
            : fallbackScholar.name
          : detailsCopy.gradedByFallback ?? "Unattributed",
        scholar: fallbackScholar ?? { name: detailsCopy.gradedByFallback ?? "Unattributed" },
        grade: {
          id: hadith.details.gradeInfo?.id ?? -1,
          title: hadith.details.gradeInfo?.title ?? hadith.details.grading,
          description: hadith.details.gradeInfo?.description,
          backgroundColor: hadith.details.gradeInfo?.backgroundColor ?? "var(--accent-emerald)",
          textColor: hadith.details.gradeInfo?.textColor ?? "#041b11",
        },
        isPrimary: true,
      } as GradeAttribution & { scholarLabel: string; isPrimary: boolean });
    }
    const primaryIndex = options.findIndex((option) => option.isPrimary);
    const ordered = primaryIndex > 0 ? [options[primaryIndex], ...options.filter((_, idx) => idx !== primaryIndex)] : options;
    return ordered;
  }, [hadith, detailsCopy.gradedByFallback]);

  const defaultGradeIndex = useMemo(() => {
    const primaryIndex = gradeOptions.findIndex((option) => option.isPrimary);
    return primaryIndex >= 0 ? primaryIndex : 0;
  }, [gradeOptions]);

  const selectedGraderIndex =
    graderSelection.hadithId === hadith?.id ? graderSelection.index : defaultGradeIndex;

  const showGradeDetails = gradeDetailState.hadithId === hadith?.id ? gradeDetailState.open : false;

  const activeGrade = useMemo(() => {
    if (!hadith || gradeOptions.length === 0) return null;
    const selected = gradeOptions[selectedGraderIndex] ?? gradeOptions[0];
    return {
      label: formatGradingLabel(selected.grade.title),
      backgroundColor: selected.grade.backgroundColor ?? "var(--accent-emerald)",
      textColor: selected.grade.textColor ?? "#041b11",
      description: selected.grade.description,
      scholarLabel: selected.scholarLabel,
    };
  }, [gradeOptions, hadith, selectedGraderIndex]);

  const hasMultipleGraders = gradeOptions.length > 1;

  const goPrevGrader = () => {
    if (!hasMultipleGraders) return;
    const nextIndex = (selectedGraderIndex - 1 + gradeOptions.length) % gradeOptions.length;
    setGraderSelection({ hadithId: hadith?.id ?? null, index: nextIndex });
    setGradeDetailState({ hadithId: hadith?.id ?? null, open: false });
  };

  const goNextGrader = () => {
    if (!hasMultipleGraders) return;
    const nextIndex = (selectedGraderIndex + 1) % gradeOptions.length;
    setGraderSelection({ hadithId: hadith?.id ?? null, index: nextIndex });
    setGradeDetailState({ hadithId: hadith?.id ?? null, open: false });
  };

  if (loading) {
    return (
      <PanelWrapper isDesktop={isDesktop} onResizeStart={onResizeStart}>
        <LoadingState message={sidebarCopy.loadingMessage} />
      </PanelWrapper>
    );
  }

  if (error) {
    return (
      <PanelWrapper isDesktop={isDesktop} onResizeStart={onResizeStart}>
        <ErrorState message={error ?? sidebarCopy.errorMessage} onRetry={onRetry} retryLabel={sidebarCopy.retryLabel} />
      </PanelWrapper>
    );
  }

  if (!hadith) {
    return (
      <PanelWrapper isDesktop={isDesktop} onResizeStart={onResizeStart}>
        <EmptyState title={detailsCopy.selectPrompt} />
      </PanelWrapper>
    );
  }

  const activeSourceTypes =
    hadith.sourceTypeDetails && hadith.sourceTypeDetails.length > 0
      ? hadith.sourceTypeDetails
      : [
          {
            id: 0,
            title: detailsCopy.fallbackTitle,
            description: detailsCopy.fallbackDescription,
          },
        ];
  const activeChainTypes =
    hadith.chainTypeDetails && hadith.chainTypeDetails.length > 0
      ? hadith.chainTypeDetails
      : [
          {
            id: 0,
            title: detailsCopy.fallbackTitle,
            description: detailsCopy.fallbackDescription,
          },
        ];
  const displayNumber = hadith.details.displayNumber ?? String(hadith.details.hadithNumber);
  const narrationDetails = hadith.narrationLevelDetail;
  const sourceAuthor = hadith.details.author ?? null;

  // Auto-load chain graph when entering Graph tab or when hadith changes.
  useEffect(() => {
    if (activeTab === "graph" && hadith?.id) {
      loadChainGraph(Number(hadith.id));
      resetNetwork();
      resetVariants();
    }
  }, [activeTab, hadith?.id, loadChainGraph, resetNetwork, resetVariants]);

  return (
    <PanelWrapper isDesktop={isDesktop} onResizeStart={onResizeStart}>
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
            {hadith.details.source}
          </h3>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            {detailsCopy.bookLabel} {hadith.details.bookNumber}, {detailsCopy.hadithLabel} {displayNumber}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs font-semibold text-[var(--text-secondary)]">
          <span className="px-3 py-1 text-right text-xs font-semibold text-[var(--text-secondary)]">
            {sourceAuthor ? (
              <>
                <span className="block text-[var(--text-primary)]">{sourceAuthor.name}</span>
                {sourceAuthor.lifespan ? (
                  <span className="mt-1 inline-block rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--text-primary)] dark:bg-[var(--surface-card)]/60 dark:text-white">
                    {sourceAuthor.lifespan}
                  </span>
                ) : null}
              </>
            ) : (
              detailsCopy.authorFallback
            )}
          </span>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("details");
            if (typeof window !== "undefined") localStorage.setItem("hadith-details-active-tab", "details");
          }}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "details"
              ? "bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--accent-emerald)] shadow-[0_6px_16px_-10px_var(--accent-emerald)]"
              : "bg-[var(--surface-card)]/90 text-[var(--text-secondary)] border border-[var(--border-soft)]"
          }`}
        >
          <span
            className={
              activeTab === "details"
                ? "underline underline-offset-4 decoration-[var(--accent-emerald)]"
                : "text-[var(--text-secondary)]"
            }
          >
            Details
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("graph");
            if (typeof window !== "undefined") localStorage.setItem("hadith-details-active-tab", "graph");
          }}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "graph"
              ? "bg-[var(--accent-emerald)] text-[var(--accent-contrast)] border border-[var(--accent-emerald)] shadow-[0_10px_24px_-12px_var(--accent-emerald)]"
              : "bg-[var(--surface-card)]/90 text-[var(--text-secondary)] border border-[var(--border-soft)]"
          }`}
        >
          <span
            className={
              activeTab === "graph"
                ? "underline underline-offset-4 decoration-[var(--accent-contrast)]"
                : "text-[var(--text-secondary)]"
            }
          >
            Graph
          </span>
        </button>
      </div>

      <div className="my-4 h-px w-full bg-[var(--border-soft)]" />

      {activeTab === "details" ? (
        <div className="scrollbar-hide mt-4 space-y-6 overflow-y-auto pr-2">
        <section className="grid gap-4 text-left text-xs text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
          <Card className="px-4 py-3 text-[var(--text-secondary)]" tone="surface">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {detailsCopy.narrationHeading}
            </p>
            {narrationDetails ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsNarrationDetailsOpen((prev) => !prev)}
                  className="mt-1 flex w-full items-center justify-between text-sm font-semibold text-[var(--text-primary)]"
                >
                  {narrationDetails.title}
                  <span className="text-[var(--text-muted)] text-xs">{isNarrationDetailsOpen ? "▴" : "▾"}</span>
                </button>
                {isNarrationDetailsOpen && (
                  <div className="mt-1 space-y-1 text-[var(--text-secondary)]">
                    {narrationDetails.secondary && (
                      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        {narrationDetails.secondary}
                      </p>
                    )}
                    <p>{narrationDetails.description}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-[var(--text-primary)]">{detailsCopy.notClassified}</p>
            )}
          </Card>

          <Card className="px-4 py-3 text-[var(--text-secondary)]" tone="surface">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {detailsCopy.attributionHeading}
            </p>
            <div className="mt-1 space-y-2">
              {activeSourceTypes.map((item) => (
                <Disclosure key={item.id ?? item.title} title={item.title} secondary={item.secondary ?? undefined}>
                  {item.description ?? detailsCopy.fallbackDescription}
                </Disclosure>
              ))}
            </div>
          </Card>

          <Card className="px-4 py-3 text-[var(--text-secondary)]" tone="surface">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {detailsCopy.chainHeading}
            </p>
            <div className="mt-1 space-y-2">
              {activeChainTypes.map((item) => (
                <Disclosure key={item.id ?? item.title} title={item.title} secondary={item.secondary ?? undefined}>
                  {item.description ?? detailsCopy.fallbackDescription}
                </Disclosure>
              ))}
            </div>
          </Card>
        </section>

        {activeGrade && (
          <div className="text-center text-sm text-[var(--text-secondary)]">
            <div className="mt-2 inline-flex items-center gap-2">
              {hasMultipleGraders && (
                <button
                  type="button"
                  aria-label="Previous grader"
                  onClick={goPrevGrader}
                  className="rounded-full bg-[var(--surface-card)] px-2 py-1 text-sm font-semibold text-[var(--text-primary)] shadow-sm hover:bg-[var(--surface-card)]/80"
                >
                  ‹
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setGradeDetailState((prev) => ({
                    hadithId: hadith?.id ?? null,
                    open: prev.hadithId === hadith?.id ? !prev.open : true,
                  }))
                }
                className="focus:outline-none"
                aria-expanded={showGradeDetails}
              >
                <Tag
                  tone="accent"
                  className="inline-flex items-center gap-2 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{
                    backgroundColor: activeGrade.backgroundColor,
                    color: activeGrade.textColor,
                    boxShadow: `0 10px 25px ${activeGrade.backgroundColor}1a`,
                  }}
                >
                  <span>{activeGrade.label}</span>
                  <span className="text-[0.85em]">{showGradeDetails ? "▴" : "▾"}</span>
                </Tag>
              </button>
              {hasMultipleGraders && (
                <button
                  type="button"
                  aria-label="Next grader"
                  onClick={goNextGrader}
                  className="rounded-full bg-[var(--surface-card)] px-2 py-1 text-sm font-semibold text-[var(--text-primary)] shadow-sm hover:bg-[var(--surface-card)]/80"
                >
                  ›
                </button>
              )}
            </div>
            {showGradeDetails && activeGrade.scholarLabel && (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text-muted)]">Graded by:</span>{" "}
                <span className="font-semibold text-[var(--text-primary)]">{activeGrade.scholarLabel}</span>
              </p>
            )}
            {showGradeDetails && activeGrade.description && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{activeGrade.description}</p>
            )}
          </div>
        )}

        <NarratorChain hadith={hadith} />
      </div>
      ) : (
        <div className="scrollbar-hide mt-4 space-y-4 overflow-y-auto pr-2">
          {graphError && <ErrorState message={graphError} />}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadChainGraph(Number(hadith.id))}
              className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm transition hover:-translate-y-0.5"
            >
              Load Isnād Graph
            </button>
            <button
              type="button"
              onClick={() => loadVariants(Number(hadith.id))}
              className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm transition hover:-translate-y-0.5"
            >
              Show Variants
            </button>
          </div>
          {graphLoading && <LoadingState message="Loading graph…" />}
          {chain ? (
            <>
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Isnād Graph</h4>
              <ChainGraph
                data={chain}
                onNarratorSelect={(narratorId) => loadNarratorNetwork(narratorId, 2)}
              />
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Load the chain graph to visualize narrators.</p>
          )}
          {variants && variants.variants.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Variants</h4>
              <VariantGraph data={variants} />
            </>
          )}
          {network && (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Narrator Network</h4>
                <button
                  type="button"
                  onClick={resetNetwork}
                  className="text-xs text-[var(--text-muted)] underline"
                >
                  Clear
                </button>
              </div>
              <NarratorNetworkGraph data={network} />
            </>
          )}
        </div>
      )}
    </PanelWrapper>
  );
}

type PanelWrapperProps = {
  children: ReactNode;
  isDesktop: boolean;
  onResizeStart?: (event: React.MouseEvent) => void;
};

function PanelWrapper({ children, isDesktop, onResizeStart }: PanelWrapperProps) {
  return (
    <aside className="scrollbar-hide relative flex max-h-svh flex-col overflow-y-auto bg-[var(--background-alt)] px-6 py-8">
      {children}
      {isDesktop && (
        <div
          role="separator"
          aria-orientation="vertical"
          className="pointer-events-auto absolute left-0 top-0 hidden h-full w-2 -translate-x-1/2 cursor-col-resize lg:block"
          onMouseDown={onResizeStart}
        >
          <span className="absolute inset-0 rounded-full bg-white/5" />
        </div>
      )}
    </aside>
  );
}
