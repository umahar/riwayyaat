import { HTMLAttributes } from "react";

type TagTone = "muted" | "accent" | "chip";

type TagProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: TagTone;
};

const toneClasses: Record<TagTone, string> = {
  muted: "border border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--text-secondary)]",
  accent: "bg-[var(--accent-emerald)] text-[var(--accent-contrast)] border border-transparent",
  chip: "border border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--text-secondary)]",
};

export function Tag({ tone = "muted", className = "", children, ...props }: TagProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
