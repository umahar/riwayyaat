import { ReactNode, useState } from "react";

type DisclosureProps = {
  title: string;
  secondary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function Disclosure({ title, secondary, children, defaultOpen = false }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm font-semibold text-[var(--text-primary)]"
      >
        {title}
        <span className="text-xs text-[var(--text-muted)]">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="space-y-1 text-[var(--text-secondary)]">
          {secondary && (
            <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {secondary}
            </p>
          )}
          <div>{children}</div>
        </div>
      )}
    </div>
  );
}
