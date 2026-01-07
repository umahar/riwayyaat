import { useCallback, useRef, useState } from "react";
import { RagCitation, RagGraph } from "@/types/rag";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: RagCitation[];
  graph?: RagGraph;
  contextHadithIds?: string[];
  timestamp: string;
};

export type ChatError = {
  message: string;
  retryable: boolean;
  status?: number;
};

type SubmitOptions = {
  filters?: Record<string, unknown>;
  limit?: number;
  contextHadithIds?: string[];
};

export function useRagChat(initialMessages: ChatMessage[] = []) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [resultHadithIds, setResultHadithIds] = useState<string[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastRequestRef = useRef<{ question: string; options: SubmitOptions } | null>(null);

  const createMessageId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `msg-${Math.random().toString(16).slice(2)}`;
  const nowIso = () => new Date().toISOString();

  const sendQuestion = useCallback(async (question: string, options: SubmitOptions, appendUser: boolean) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    lastRequestRef.current = { question: trimmed, options };

    if (appendUser) {
      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: trimmed,
        contextHadithIds: options.contextHadithIds?.length ? options.contextHadithIds : undefined,
        timestamp: nowIso(),
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    setIsLoading(true);
    setError(null);
    setResultHadithIds(null);
    try {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          filters: options.filters ?? {},
          limit: options.limit ?? 5,
        }),
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      const payload = (await response.json().catch(() => ({}))) as {
        answer?: string;
        citations?: RagCitation[];
        graph?: RagGraph;
        retrieved?: Array<{ hadithId: number }>;
        error?: string;
      };
      if (!response.ok || payload.error) {
        const status = response.status || undefined;
        const retryable = status === 429 || status === 503;
        const message = payload.error ?? `Request failed (${response.status})`;
        setError({
          message: retryable ? `${message} — retry recommended.` : message,
          retryable,
          status,
        });
        return;
      }
      const citationIds = payload.citations?.map((citation) => String(citation.hadithId)) ?? [];
      const retrievedIds = Array.isArray(payload.retrieved)
        ? payload.retrieved.map((item) => String(item.hadithId))
        : [];
      setResultHadithIds(citationIds.length > 0 ? citationIds : retrievedIds);
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: payload.answer ?? "No answer available.",
        citations: payload.citations ?? [],
        graph: payload.graph,
        timestamp: nowIso(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      console.error("[useRagChat] Failed to fetch answer", err);
      setError({
        message: "Could not load an answer. Please try again.",
        retryable: true,
      });
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const submitQuestion = useCallback(
    async (question: string, options: SubmitOptions = {}) => {
      await sendQuestion(question, options, true);
    },
    [sendQuestion],
  );

  const retryLast = useCallback(() => {
    const last = lastRequestRef.current;
    if (!last) return;
    void sendQuestion(last.question, last.options, false);
  }, [sendQuestion]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setResultHadithIds(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    resultHadithIds,
    submitQuestion,
    retryLast,
    reset,
  };
}
