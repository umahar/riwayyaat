"use client";

import { FormEvent } from "react";
import { Message } from "@/lib/hadith/types";

type ConversationPanelProps = {
  messages: Message[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
};

export function ConversationPanel({ messages, input, onInputChange, onSend }: ConversationPanelProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <div className="relative flex max-h-svh flex-col border-r border-[var(--border-soft)] bg-[var(--background)]">
      <header className="border-b border-[var(--border-soft)] px-8 py-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Conversation</h2>
        <p className="text-sm text-[var(--text-muted)]">
          System streams insights, sanad graphs, and commentary context in real time.
        </p>
      </header>
      <div className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-8 py-6">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${
                message.role === "user"
                  ? "bg-[var(--accent-emerald)] text-[var(--accent-contrast)] border-transparent"
                  : "bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-soft)]"
              }`}
            >
              {message.content}
            </div>
            <span className="mt-1 text-xs text-[var(--text-subtle)]">
              {message.role === "user" ? "You" : "Riwayyaat Copilot"} · {message.timestamp}
            </span>
          </article>
        ))}
      </div>
      <footer className="border-t border-[var(--border-soft)] px-8 py-5">
        <form className="flex gap-3" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="workspace-input">
            Continue the conversation
          </label>
          <input
            id="workspace-input"
            type="text"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Ask about narrators, sanad overlaps, or commentary..."
            className="flex-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-emerald)] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl bg-[var(--accent-emerald)] px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:opacity-90"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
