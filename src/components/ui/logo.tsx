import { siteConfig } from "@/lib/site";

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-2 text-[var(--text-primary)] backdrop-blur ${className ?? ""}`}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold shadow-lg shadow-[var(--shadow-panel)]"
        style={{
          backgroundColor: "var(--accent-emerald)",
          color: "var(--accent-contrast)",
        }}
      >
        {siteConfig.shortName}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">
          {siteConfig.name}
        </span>
        <span className="text-base font-semibold text-[var(--text-primary)]">
          {siteConfig.byline}
        </span>
      </div>
    </div>
  );
}
