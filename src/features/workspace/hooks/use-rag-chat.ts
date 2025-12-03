import { useCallback, useState } from "react";
import { RagCitation } from "@/types/rag";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: RagCitation[];
  timestamp: string;
};

type SubmitOptions = {
  filters?: Record<string, unknown>;
  limit?: number;
};

export function useRagChat(initialMessages: ChatMessage[] = []) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitQuestion = useCallback(
    async (question: string, options: SubmitOptions = {}) => {
      const trimmed = question.trim();
      if (!trimmed || isLoading) return;
      const timestamp = new Date().toLocaleTimeString();
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/rag/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            filters: options.filters ?? {},
            limit: options.limit ?? 5,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          answer?: string;
          citations?: RagCitation[];
          error?: string;
        };
        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? `Request failed (${response.status})`);
        }
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.answer ?? "No answer available.",
          citations: payload.citations ?? [],
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        console.error("[useRagChat] Failed to fetch answer", err);
        setError("Could not load an answer. Please try again.");
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "I couldn’t load an answer right now. Please retry.",
          citations: [],
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    error,
    submitQuestion,
    reset,
  };
}
