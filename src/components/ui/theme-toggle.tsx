"use client";

import { useTheme } from "@/components/theme/theme-provider";
import { themeCopy } from "@/content/text";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const nextMode = isLight ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`${themeCopy.toggle.labelPrefix} ${nextMode} ${themeCopy.toggle.labelSuffix}`}
      aria-pressed={isLight}
      className={`theme-toggle-btn inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] p-0 text-base text-[var(--text-primary)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-emerald)] ${className}`}
      style={
        isLight
          ? undefined
          : {
              color: "#f1f5f9", // brighter icon in dark mode only
              borderColor: "rgba(255,255,255,0.18)",
              backgroundColor: "rgba(255,255,255,0.05)",
            }
      }
    >
      <span className="text-lg" aria-hidden="true">
        {isLight ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
