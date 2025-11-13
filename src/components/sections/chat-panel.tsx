"use client";

import { FormEvent, useMemo, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { siteConfig } from "@/lib/site";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type ChatPanelProps = {
  onSubmit?: (prompt: string) => void;
};

export function ChatPanel({ onSubmit }: ChatPanelProps) {
  const { examplePrompts } = siteConfig;
  const promptPairs = useMemo(
    () =>
      examplePrompts.map((prompt, index) => ({
        id: `${index}-${prompt.slice(0, 8)}`,
        prompt,
      })),
    [examplePrompts],
  );

  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValue = value.trim();
    if (!nextValue) return;
    onSubmit?.(nextValue);
    setValue("");
  };

  const handlePromptClick = (prompt: string) => {
    onSubmit?.(prompt);
    setValue("");
  };

  return (
    <section
      id="copilot"
      className="relative isolate flex min-h-svh items-center justify-center overflow-hidden px-6 py-16 text-[var(--text-primary)] md:px-12 lg:px-20"
    >
      <AuroraBackground showSheen={false} />
      <ThemeToggle className="absolute right-6 top-6" />

      <div
        className="relative flex w-full max-w-3xl flex-col items-center gap-8 rounded-[32px] border px-8 py-12 text-center shadow-2xl backdrop-blur-2xl sm:px-12"
        style={{
          borderColor: "var(--border-soft)",
          backgroundColor: "var(--surface-panel)",
          boxShadow: `0 35px 90px -40px var(--shadow-panel)`,
        }}
      >
        <Logo />
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[var(--tracking-wide)] text-[var(--text-muted)]">
            Riwayyaat Copilot
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-[var(--tracking-tight)] text-balance text-[var(--text-primary)]">
            Ask any question about a hadith, its matn, or sanad.
          </h1>
          <p className="text-base text-[var(--text-secondary)]">
            Describe a narration, compare transmissions, probe narrator
            reliability, or surface commentaries—all from one canvas.
          </p>
        </div>

        <form className="w-full space-y-3" onSubmit={handleSubmit}>
          <div
            className="flex flex-col gap-3 rounded-[28px] border p-2 text-left shadow-inner sm:flex-row sm:items-center sm:p-3"
            style={{
              borderColor: "var(--input-border)",
              backgroundColor: "var(--surface-input)",
              boxShadow: `inset 0 0 60px rgba(0,0,0,0.15)`,
            }}
          >
            <label className="sr-only" htmlFor="hadith-question">
              Ask about any hadith
            </label>
            <input
              id="hadith-question"
              type="text"
              autoComplete="off"
              placeholder="Ask anything about any hadith, its matn, or sanad..."
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="flex-1 rounded-[20px] border border-transparent bg-transparent px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--input-border-focus)] focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full px-6 py-3 text-base font-semibold transition hover:opacity-90"
              style={{
                backgroundColor: "var(--accent-emerald)",
                color: "var(--accent-contrast)",
              }}
            >
              Ask
            </button>
          </div>
        </form>

        <div className="flex w-full flex-col gap-3 text-left">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-subtle)]">
            Try asking
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {promptPairs.map(({ id, prompt }) => (
              <button
                key={id}
                type="button"
                className="group flex min-w-[240px] flex-1 items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm transition hover:translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-emerald)]"
                style={{
                  borderColor: "var(--chip-border)",
                  backgroundColor: "var(--chip-bg)",
                  color: "var(--example-text)",
                }}
                onClick={() => handlePromptClick(prompt)}
              >
                <span
                  className="text-lg"
                  style={{ color: "var(--accent-emerald)" }}
                >
                  ✦
                </span>
                <span className="leading-snug text-balance">{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
