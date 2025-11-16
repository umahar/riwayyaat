"use client";

import { footerCopy } from "@/content/text";

export function ProjectFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-soft)] bg-[var(--background-alt)]/90 px-4 py-2 text-xs text-[var(--text-secondary)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4">
          <span className="font-semibold text-[var(--text-primary)]">{footerCopy.projectLabel}</span>
          <span>{footerCopy.studentLine}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">
            This tool is for study only; verify with qualified scholars.
          </span>
        </div>
      </div>
    </footer>
  );
}
