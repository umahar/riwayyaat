import { useEffect, useRef, useState } from "react";

export type FilterOption = {
  label: string;
  value: string;
};

type FilterMenuProps = {
  label: string;
  menuTitle?: string;
  options: FilterOption[];
  selectedValues: Set<string>;
  onToggle: (value: string) => void;
  onClear?: () => void;
  className?: string;
};

const BASE_FILTER_BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-emerald)]";
const INACTIVE_BUTTON_CLASSES =
  "border border-[var(--border-soft)] bg-[var(--surface-card)] text-[var(--text-muted)]";
const ACTIVE_BUTTON_CLASSES =
  "border border-[var(--accent-emerald)] bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]";

export function FilterMenu({
  label,
  menuTitle,
  options,
  selectedValues,
  onToggle,
  onClear,
  className = "",
}: FilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const isActive = selectedValues.size > 0;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`${BASE_FILTER_BUTTON} ${
          isActive ? ACTIVE_BUTTON_CLASSES : INACTIVE_BUTTON_CLASSES
        }`}
      >
        <span>{label}</span>
        <span className="text-xs">▾</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-popover)] p-3 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]">
            {menuTitle ?? `Select ${label.toLowerCase()}`}
          </p>
          <div className="mt-2 space-y-1">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-2 rounded-xl px-2 py-1 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel)]"
              >
                <input
                  type="checkbox"
                  className="rounded border-[var(--border-soft)] text-[var(--accent-emerald)] focus:ring-[var(--accent-emerald)]"
                  checked={selectedValues.has(option.value)}
                  onChange={() => onToggle(option.value)}
                />
                <span className="flex-1 whitespace-normal break-words text-left leading-snug">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
