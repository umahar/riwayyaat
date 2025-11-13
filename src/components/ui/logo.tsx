import { siteConfig } from "@/lib/site";

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-1.5 text-[var(--text-primary)] backdrop-blur ${className ?? ""}`}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold shadow-lg shadow-[var(--shadow-panel)]"
        style={{
          backgroundColor: "var(--accent-emerald)",
          color: "var(--accent-contrast)",
        }}
      >
        {siteConfig.shortName}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[0.6rem] uppercase tracking-[0.35em] text-[var(--text-muted)]">
          {siteConfig.name}
        </span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {siteConfig.byline}
        </span>
      </div>
    </div>
  );
}
