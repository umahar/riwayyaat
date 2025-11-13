"use client";

export function ProjectFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-soft)] bg-[var(--background-alt)]/90 px-4 py-2 text-xs text-[var(--text-secondary)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4">
          <span className="font-semibold text-[var(--text-primary)]">
            Masters Research Project
          </span>
          <span>Umair Abdullah • B01007607 • Abdullah-U@ulster.ac.uk</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[var(--text-muted)]">Supervised by</span>
          <span className="font-semibold text-[var(--text-primary)]">
            Dr. Marwan M Radwan
          </span>
        </div>
      </div>
    </footer>
  );
}
