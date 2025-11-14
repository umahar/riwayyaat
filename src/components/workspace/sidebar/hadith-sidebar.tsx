"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { IconButton } from "@/components/ui/button";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { HadithInsight } from "@/lib/hadith/types";
import { workspaceCopy } from "@/content/text";
import { HadithCard } from "./hadith-card";

export type FilterGroup = {
  key: "grading" | "book" | "source";
  label: string;
  menuTitle: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  clearLabel: string;
};

type HadithSidebarProps = {
  collapsed: boolean;
  isDesktop: boolean;
  onToggleCollapse: () => void;
  onResizeStart?: (event: React.MouseEvent) => void;
  onNewChat: () => void;
  hadiths: HadithInsight[];
  activeHadithId: string | null;
  onSelectHadith: (id: string) => void;
  filterGroups: FilterGroup[];
};

export function HadithSidebar({
  collapsed,
  isDesktop,
  onToggleCollapse,
  onResizeStart,
  onNewChat,
  hadiths,
  activeHadithId,
  onSelectHadith,
  filterGroups,
}: HadithSidebarProps) {
  const [expandedMatnIds, setExpandedMatnIds] = useState<Set<string>>(new Set());
  const copy = workspaceCopy.sidebar;
  const toggleMatn = (id: string) => {
    setExpandedMatnIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCardSelect = (id: string) => {
    onSelectHadith(id);
    toggleMatn(id);
  };

  return (
    <aside className="scrollbar-hide relative flex max-h-svh flex-col gap-7 overflow-y-auto border-r border-[var(--border-soft)] bg-transparent px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        {!collapsed && (
          <div className="flex flex-1 items-center justify-between gap-3">
            <Logo className="scale-90 transform" />
            <div className="flex items-center gap-2">
              <IconButton label={copy.newChatLabel} onClick={onNewChat}>
                ✦
              </IconButton>
              <ThemeToggle className="hover:-translate-y-0.5" />
            </div>
          </div>
        )}
        <IconButton
          label={collapsed ? copy.expandLabel : copy.collapseLabel}
          onClick={onToggleCollapse}
        >
          {collapsed ? "→" : "←"}
        </IconButton>
      </div>

      {!collapsed && (
        <>
          <header className="space-y-1">
            <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap sm:gap-3">
                <div className="flex flex-col whitespace-nowrap">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {copy.heading}
                  </p>
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    {hadiths.length} {copy.resultsSuffix}
                  </p>
                </div>
                <div className="flex flex-nowrap items-center gap-2 sm:gap-3">
                  {filterGroups.map((group) => (
                    <FilterMenu
                      key={group.key}
                    label={group.label}
                    menuTitle={group.menuTitle}
                    options={group.options.map<FilterOption>((value) => ({
                      label: value,
                      value,
                    }))}
                      selectedValues={group.selected}
                      onToggle={group.onToggle}
                      onClear={group.onClear}
                      clearLabel={group.clearLabel}
                    />
                  ))}
                </div>
            </div>
          </header>
          <div className="space-y-6">
            {hadiths.length > 0 ? (
              hadiths.map((hadith) => (
                <HadithCard
                  key={hadith.id}
                  hadith={hadith}
                  active={activeHadithId === hadith.id}
                  expanded={expandedMatnIds.has(hadith.id)}
                  onSelect={handleCardSelect}
                />
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">{copy.emptyState}</p>
            )}
          </div>
        </>
      )}
      {isDesktop && !collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          className="pointer-events-auto absolute right-0 top-0 hidden h-full w-2 translate-x-1/2 cursor-col-resize lg:block"
          onMouseDown={onResizeStart}
        >
          <span className="absolute inset-0 rounded-full bg-white/5" />
        </div>
      )}
    </aside>
  );
}
