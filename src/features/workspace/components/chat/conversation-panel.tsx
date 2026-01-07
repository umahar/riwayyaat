"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { workspaceCopy } from "@/content/text";
import { ChatError, ChatMessage } from "@/features/workspace/hooks/use-rag-chat";
import { AnswerGraphModal } from "@/features/workspace/components/chat/answer-graph-modal";

type ConversationPanelProps = {
  messages: ChatMessage[];
  loading: boolean;
  error: ChatError | null;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onRetry?: () => void;
  onCitationSelect?: (hadithId: string) => void;
  onContextSelect?: (hadithId: string) => void;
  contextItems?: Array<{ id: string; label: string }>;
  onClearContext?: () => void;
  onRemoveContext?: (id: string) => void;
};

export function ConversationPanel({
  messages,
  loading,
  error,
  input,
  onInputChange,
  onSend,
  onRetry,
  onCitationSelect,
  onContextSelect,
  contextItems,
  onClearContext,
  onRemoveContext,
}: ConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [activeGraph, setActiveGraph] = useState<ChatMessage["graph"] | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    onSend();
  };
  const copy = workspaceCopy.conversation;

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const threshold = 48;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom <= threshold;
  };

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading, error]);

  const getRequestedCount = (text: string) => {
    const lower = text.toLowerCase();
    const match = lower.match(/\b(\d+)\s+(?:hadith|hadiths|narrations|reports)\b/);
    if (!match?.[1]) return null;
    const count = Number(match[1]);
    if (!Number.isFinite(count) || count <= 0) return null;
    return Math.min(Math.max(1, Math.trunc(count)), 20);
  };

  return (
    <div className="relative flex max-h-svh flex-col border-r border-[var(--border-soft)] bg-[var(--background)]">
      <header className="border-b border-[var(--border-soft)] px-8 py-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{copy.title}</h2>
        <p className="text-sm text-[var(--text-muted)]">{copy.description}</p>
      </header>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-8 py-6"
      >
        {error && (
          <div
            className="flex items-center justify-between gap-3 rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200"
            role="status"
          >
            <span>{error.message}</span>
            {error.retryable && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-red-400/50 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 transition hover:-translate-y-0.5"
              >
                Retry
              </button>
            ) : null}
          </div>
        )}
        {messages.map((message, index) => {
          const prevMessage = messages[index - 1];
          const requestedCount =
            message.role === "assistant" && prevMessage?.role === "user"
              ? getRequestedCount(prevMessage.content)
              : null;
          const citationCount = message.citations?.length ?? 0;
          const shouldShowShortfall =
            message.role === "assistant" && requestedCount != null && citationCount > 0 && citationCount < requestedCount;
          const shortfallLabel = shouldShowShortfall
            ? `Only ${citationCount} of ${requestedCount} matching hadiths were found.`
            : null;
          const isContextualUser = message.role === "user" && (message.contextHadithIds?.length ?? 0) > 0;
          return (
          <article
            key={message.id}
            className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${
                message.role === "user"
                  ? `bg-[var(--accent-emerald)] text-[var(--accent-contrast)] border-transparent ${
                      isContextualUser ? "ring-1 ring-[var(--accent-emerald)]/35 ring-offset-2 ring-offset-[var(--background)]" : ""
                    }`
                  : "bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-soft)]"
              }`}
            >
              {message.content}
            </div>
            {isContextualUser ? (
              <span className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-subtle)]">
                Context · {message.contextHadithIds?.length}
              </span>
            ) : null}
            {message.role === "assistant" && (
              <div className="mt-2 space-y-2 text-xs text-[var(--text-muted)]">
                {message.citations && message.citations.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--text-secondary)]">Sources</span>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-2 py-1 text-xs text-[var(--text-primary)] shadow-sm transition hover:-translate-y-0.5"
                      title="View graph"
                      onClick={() => setActiveGraph(message.graph ?? null)}
                      disabled={!message.graph}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="6" cy="6" r="3" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="12" cy="18" r="3" />
                        <path d="M8.7 7.7l3 8.2M15.3 7.7l-3 8.2" />
                      </svg>
                    </button>
                    {message.citations.map((citation) => (
                      <button
                        key={`${citation.hadithId}-${citation.displayNumber ?? "?"}`}
                        type="button"
                        className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-1 text-xs text-[var(--text-primary)] shadow-sm transition hover:-translate-y-0.5"
                        onClick={() => onCitationSelect?.(String(citation.hadithId))}
                      >
                        {citation.source} — {citation.displayNumber ?? citation.hadithId}
                      </button>
                    ))}
                  </div>
                ) : null}
                {shortfallLabel ? <p className="text-[var(--text-muted)]">{shortfallLabel}</p> : null}
              </div>
            )}
            <span className="mt-1 text-xs text-[var(--text-subtle)]">
              {message.role === "user" ? copy.userLabel : copy.assistantLabel} · {message.timestamp}
            </span>
          </article>
        );
        })}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="h-2 w-2 animate-ping rounded-full bg-[var(--accent-emerald)]" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <AnswerGraphModal
        graph={activeGraph ?? null}
        open={activeGraph !== null}
        onClose={() => setActiveGraph(null)}
      />
      <footer className="border-t border-[var(--border-soft)] px-8 py-5">
        {contextItems && contextItems.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-2 text-xs text-[var(--text-primary)] shadow-sm">
            <span className="font-semibold uppercase tracking-[0.15em] text-[0.55rem] text-[var(--text-muted)]">
              Context
            </span>
            <div className="flex flex-1 flex-wrap gap-2">
                {contextItems.map((item) => (
                  <span
                    key={item.id}
                    className="flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-panel)] px-2 py-1 text-[0.6rem] text-[var(--text-secondary)]"
                  >
                    <button
                      type="button"
                      onClick={() => onContextSelect?.(item.id)}
                      className="text-left transition hover:opacity-80"
                    >
                      {item.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveContext?.(item.id)}
                      className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-1 text-[0.55rem] text-[var(--text-primary)] transition hover:-translate-y-0.5"
                    aria-label={`Remove ${item.label} from context`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={onClearContext}
              className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-panel)] px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition hover:-translate-y-0.5"
            >
              Clear
            </button>
          </div>
        ) : null}
        <form className="flex gap-3" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="workspace-input">
            {copy.inputLabel}
          </label>
          <textarea
            id="workspace-input"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={copy.placeholder}
            disabled={loading}
            rows={2}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || isComposing) return;
              event.preventDefault();
              onSend();
            }}
            className="flex-1 resize-none rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-emerald)] focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-[var(--accent-emerald)] px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Thinking…" : copy.sendLabel}
          </button>
        </form>
      </footer>
    </div>
  );
}
