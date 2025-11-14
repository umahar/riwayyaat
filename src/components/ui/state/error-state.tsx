export type ErrorStateProps = {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, retryLabel = "Retry", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-[var(--accent-emerald)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-emerald)] transition hover:bg-[var(--accent-emerald)]/10"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
