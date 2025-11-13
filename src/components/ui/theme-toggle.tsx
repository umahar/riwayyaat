"use client";

import { useTheme } from "@/components/theme/theme-provider";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      aria-pressed={isLight}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border p-0 text-base transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-emerald)] ${className}`}
      style={{
        borderColor: "var(--border-soft)",
        color: "var(--text-primary)",
        backgroundColor: "var(--surface-card)",
      }}
    >
      <span className="text-lg" aria-hidden="true">
        {isLight ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
