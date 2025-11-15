"use client";

import { HadithInsight } from "@/lib/hadith/types";
import { formatGradingLabel } from "@/lib/hadith/taxonomy";
import { Tag } from "@/components/ui/tag";
import { workspaceCopy } from "@/content/text";

type HadithCardProps = {
  hadith: HadithInsight;
  active: boolean;
  expanded: boolean;
  onSelect: (id: string) => void;
};

const MATN_PREVIEW_LIMIT = 220;

export function HadithCard({ hadith, active, expanded, onSelect }: HadithCardProps) {
  const gradingLabel = formatGradingLabel(hadith.details.grading);
  const badgeBackground = hadith.details.gradeInfo?.backgroundColor ?? "var(--accent-emerald)";
  const badgeColor = hadith.details.gradeInfo?.textColor ?? "#041b11";
  const truncated =
    hadith.matn.length > MATN_PREVIEW_LIMIT
      ? `${hadith.matn.slice(0, MATN_PREVIEW_LIMIT)}…`
      : hadith.matn;
  const matnPreview = expanded ? hadith.matn : truncated;
  const detailsCopy = workspaceCopy.details;

  return (
    <article
      onClick={() => onSelect(hadith.id)}
      className={`cursor-pointer rounded-3xl border bg-[var(--workspace-card-bg)] px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? "border-[var(--accent-emerald)] shadow-lg" : "border-[var(--workspace-card-border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1fb276]">
            {hadith.details.location}
          </p>
          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {hadith.details.book}
          </p>
        </div>
        <Tag tone="chip" className={active ? "text-[#1fb276]" : ""}>
          {hadith.details.source}
        </Tag>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{matnPreview}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Tag
          tone="accent"
          className="tracking-[0.15em]"
          style={{
            backgroundColor: badgeBackground,
            color: badgeColor,
          }}
        >
          {gradingLabel}
        </Tag>
        <Tag tone="chip" className="text-[var(--text-secondary)]">
          {hadith.details.chapter}
        </Tag>
        <Tag tone="chip" className="text-[var(--text-secondary)]">
          {detailsCopy.bookLabel} {hadith.details.bookNumber}
        </Tag>
      </div>
    </article>
  );
}
