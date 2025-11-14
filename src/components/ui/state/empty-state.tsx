export type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[var(--text-secondary)]">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {description ? <p className="text-xs text-[var(--text-muted)]">{description}</p> : null}
    </div>
  );
}
