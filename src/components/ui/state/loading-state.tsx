export type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-[var(--text-secondary)]">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-emerald)] border-t-transparent" aria-hidden="true" />
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}
