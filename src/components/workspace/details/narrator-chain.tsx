"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  narratorLifespans,
  narratorTierInfo,
  reliabilityTierInfo,
  transmissionMethods,
} from "@/lib/hadith/taxonomy";
import { HadithInsight } from "@/lib/hadith/types";
import { workspaceCopy } from "@/content/text";

type NarratorChainProps = {
  hadith: HadithInsight;
};

export function NarratorChain({ hadith }: NarratorChainProps) {
  const [expandedNarrators, setExpandedNarrators] = useState<Set<string>>(new Set());
  const copy = workspaceCopy.narratorChain;
  const handleToggle = (name: string) => {
    setExpandedNarrators((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const nonProphetNarratorCount = hadith.chain.filter((node) => node.type !== "prophet").length;

  return (
    <Card tone="panel" className="p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {copy.sectionTitle}
        </h4>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {nonProphetNarratorCount} {copy.countSuffix}
        </span>
      </div>
      <ul className="mt-4 space-y-5">
        {hadith.chain.map((node, index) => {
          const isProphet = node.type === "prophet";
          const isExpanded = expandedNarrators.has(node.name);
          const tierInfo = !isProphet && node.classification ? narratorTierInfo[node.classification] : null;
          const tierLabel = tierInfo?.title ? tierInfo.title.split(" (")[0] : node.descriptor;
          const reliabilityInfo = !isProphet && node.reliability ? reliabilityTierInfo[node.reliability] : null;
          const nodeLifespan = narratorLifespans[node.name];
          const connectorColor =
            !isProphet && reliabilityInfo ? reliabilityInfo.background : "var(--border-soft)";
          const methodInfo = transmissionMethods[index % transmissionMethods.length];
          const baseClasses = isProphet
            ? "bg-gradient-to-r from-[#0b7a6c] to-[#1b4332] text-white border-transparent shadow-lg"
            : isExpanded
              ? "border-[var(--accent-emerald)] bg-[var(--background)]"
              : "border-[var(--border-soft)] bg-[var(--background)]";

          return (
            <li key={node.name} className="relative pl-6">
              {!isProphet && (
                <span
                  className="absolute left-3 top-[10%] h-[80%] w-[2px]"
                  style={{ backgroundColor: connectorColor }}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (isProphet) return;
                  handleToggle(node.name);
                }}
                className={`relative w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${baseClasses}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      {!isProphet && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 text-[0.7rem] text-[var(--accent-emerald)]">
                          {index + 1}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[color:inherit]">{node.name}</p>
                        <p
                          className={`mt-0.5 text-xs ${
                            isProphet ? "text-white/80" : "text-[var(--text-muted)]"
                          }`}
                        >
                          {isProphet ? node.descriptor : tierLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!isProphet && (
                    <div className="flex flex-col items-center gap-1">
                      {reliabilityInfo && (
                        <span
                          className="rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em]"
                          style={{
                            backgroundColor: reliabilityInfo.background,
                            color: reliabilityInfo.color,
                          }}
                        >
                          {reliabilityInfo.badge}
                        </span>
                      )}
                      {nodeLifespan && (
                        <span className="text-[0.65rem] font-semibold text-[var(--text-primary)] dark:text-white">
                          {nodeLifespan}
                        </span>
                      )}
                    </div>
                  )}
                  {isProphet ? (
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/30 text-xl text-white shadow-[0_8px_25px_rgba(255,255,255,0.35)] ring-2 ring-white/40">
                      ﷺ
                    </span>
                  ) : (
                    <span className="text-lg">{isExpanded ? "−" : "+"}</span>
                  )}
                </div>
                {!isProphet && node.descriptor && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">{node.descriptor}</p>
                )}
                {isExpanded && !isProphet && (
                  <div className="mt-3 space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {copy.generationalRank}:{" "}
                        <span className="text-[var(--text-primary)]">
                          {tierInfo?.title ?? "Narrator"}
                        </span>
                        {tierInfo?.secondary && (
                          <span className="ml-2 text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                            {tierInfo.secondary}
                          </span>
                        )}
                      </p>
                      <p>{tierInfo?.description ?? copy.roleFallback}</p>
                    </div>
                    {reliabilityInfo && (
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">
                          {copy.reliabilityRank}:{" "}
                          <span className="text-[var(--text-primary)]">
                            {reliabilityInfo.title}
                          </span>
                        </p>
                        {reliabilityInfo.secondary && (
                          <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                            {reliabilityInfo.secondary}
                          </p>
                        )}
                        <p>{reliabilityInfo.description}</p>
                      </div>
                    )}
                    {methodInfo && (
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">
                          {copy.transmissionMethod}:{" "}
                          <span className="text-[var(--text-primary)]">{methodInfo.title}</span>
                        </p>
                        <p>{methodInfo.description}</p>
                      </div>
                    )}
                  </div>
                )}
                {!isProphet && methodInfo && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-1/2 h-6 w-28 -translate-x-1/2 translate-y-1/2 overflow-hidden rounded-full border border-[var(--border-soft)] bg-[#dbeafe] text-center text-[0.55rem] font-semibold uppercase text-[#0f172a] shadow-sm dark:bg-[#1e293b] dark:text-white"
                    title={methodInfo.description}
                  >
                    <span className="flex h-full w-full items-center justify-center">
                      {methodInfo.title}
                    </span>
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
