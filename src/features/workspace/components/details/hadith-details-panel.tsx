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

  const [selectedGraderIndex, setSelectedGraderIndex] = useState(0);
  const [showScholarInfo, setShowScholarInfo] = useState(false);

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

  useEffect(() => {
    const primaryIndex = gradeOptions.findIndex((option) => option.isPrimary);
    setSelectedGraderIndex(primaryIndex >= 0 ? primaryIndex : 0);
    setShowScholarInfo(false);
  }, [hadith?.id, gradeOptions]);

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
    setSelectedGraderIndex((prev) => (prev - 1 + gradeOptions.length) % gradeOptions.length);
    setShowScholarInfo(false);
  };

  const goNextGrader = () => {
    if (!hasMultipleGraders) return;
    setSelectedGraderIndex((prev) => (prev + 1) % gradeOptions.length);
    setShowScholarInfo(false);
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
  const narrationDetails = hadith.narrationLevelDetail;
  const sourceAuthor = hadith.details.author ?? null;
  const gradedByLabel = detailsCopy.gradedByLabel ?? "Graded by";

  return (
    <PanelWrapper isDesktop={isDesktop} onResizeStart={onResizeStart}>
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
            {hadith.details.source}
          </h3>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            {detailsCopy.bookLabel} {hadith.details.bookNumber}, {detailsCopy.hadithLabel}{" "}
            {hadith.details.hadithNumber}
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

      <div className="my-4 h-px w-full bg-[var(--border-soft)]" />

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
                onClick={() => (hasMultipleGraders ? setShowScholarInfo((prev) => !prev) : undefined)}
                className="focus:outline-none"
                aria-expanded={hasMultipleGraders ? showScholarInfo : undefined}
              >
                <Tag
                  tone="accent"
                  className="inline-flex px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{
                    backgroundColor: activeGrade.backgroundColor,
                    color: activeGrade.textColor,
                    boxShadow: `0 10px 25px ${activeGrade.backgroundColor}1a`,
                  }}
                >
                  {activeGrade.label}
                  {hasMultipleGraders && <span className="ml-2 text-[0.85em]">{showScholarInfo ? "▴" : "▾"}</span>}
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
            {activeGrade.description && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{activeGrade.description}</p>
            )}
            {activeGrade.scholarLabel && (showScholarInfo || !hasMultipleGraders) && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">Graded by {activeGrade.scholarLabel}</p>
            )}
          </div>
        )}

        <NarratorChain hadith={hadith} />
      </div>
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
