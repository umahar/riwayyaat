"use client";

import { ReactNode, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { Tag } from "@/components/ui/tag";
import {
  chainTypeInfo,
  formatGradingLabel,
  getGradingStyle,
  narrationLevelInfo,
  sourceAuthorMap,
  sourceTypeInfo,
} from "@/lib/hadith/taxonomy";
import { HadithInsight } from "@/lib/hadith/types";
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

  const gradingData = useMemo(() => {
    if (!hadith) return null;
    const style = getGradingStyle(hadith.details.grading);
    const label = formatGradingLabel(hadith.details.grading);
    return { style, label };
  }, [hadith]);

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

  const activeSourceTypes = sourceTypeInfo.filter((item) => hadith.sourceTypes.includes(item.key));
  const activeChainTypes = chainTypeInfo.filter((item) => hadith.chainTypes.includes(item.key));
  const narrationDetails = narrationLevelInfo[hadith.narrationLevel];
  const sourceAuthor = sourceAuthorMap[hadith.details.source] ?? null;

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
                <span className="mt-1 inline-block rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--text-primary)] dark:bg-[var(--surface-card)]/60 dark:text-white">
                  {sourceAuthor.lifespan}
                </span>
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
              {(activeSourceTypes.length
                ? activeSourceTypes
                : [
                    {
                      key: "none",
                      title: detailsCopy.fallbackTitle,
                      description: detailsCopy.fallbackDescription,
                    },
                  ]
              ).map((item) => (
                <Disclosure key={item.key} title={item.title} secondary={item.secondary}>
                  {item.description}
                </Disclosure>
              ))}
            </div>
          </Card>

          <Card className="px-4 py-3 text-[var(--text-secondary)]" tone="surface">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {detailsCopy.chainHeading}
            </p>
            <div className="mt-1 space-y-2">
              {(activeChainTypes.length
                ? activeChainTypes
                : [
                    {
                      key: "none",
                      title: detailsCopy.fallbackTitle,
                      description: detailsCopy.fallbackDescription,
                    },
                  ]
              ).map((item) => (
                <Disclosure key={item.key} title={item.title} secondary={item.secondary}>
                  {item.description}
                </Disclosure>
              ))}
            </div>
          </Card>
        </section>

        {gradingData && (
          <div className="text-center text-xs text-[var(--text-secondary)]">
            <Tag
              tone="accent"
              className="mt-2 inline-flex px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
              style={{
                backgroundColor: gradingData.style.background,
                color: gradingData.style.color,
                boxShadow: `0 10px 25px ${gradingData.style.background}1a`,
              }}
            >
              {gradingData.label}
            </Tag>
            {gradingData.style.description && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{gradingData.style.description}</p>
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
