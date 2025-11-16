import { useCallback, useState } from "react";
import { GraphApiNode, GraphApiEdge } from "@/server/graph/types";

export type GraphData = {
  nodes: GraphApiNode[];
  edges: GraphApiEdge[];
};

export type VariantsData = {
  baseHadithId: number;
  variants: Array<{
    hadithId: number;
    displayNumber: string;
    source: string;
    similarityReason: string;
  }>;
};

const fetchGraph = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
};

export function useGraph() {
  const [chain, setChain] = useState<GraphData | null>(null);
  const [variants, setVariants] = useState<VariantsData | null>(null);
  const [network, setNetwork] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChainGraph = useCallback(async (hadithId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraph<GraphData>("/api/graph/chain", { hadithId });
      setChain(data);
    } catch (err) {
      console.error("[useGraph] Failed to load chain graph", err);
      setError("Unable to load chain graph.");
      setChain(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVariants = useCallback(async (hadithId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraph<VariantsData>("/api/graph/variants", { hadithId });
      setVariants(data);
    } catch (err) {
      console.error("[useGraph] Failed to load variants", err);
      setError("Unable to load variants.");
      setVariants(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNarratorNetwork = useCallback(async (narratorId: number, depth = 2) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraph<GraphData>("/api/graph/narrator-network", { narratorId, depth });
      setNetwork(data);
    } catch (err) {
      console.error("[useGraph] Failed to load narrator network", err);
      setError("Unable to load narrator network.");
      setNetwork(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetNetwork = useCallback(() => setNetwork(null), []);
  const resetVariants = useCallback(() => setVariants(null), []);

  return {
    chain,
    variants,
    network,
    loading,
    error,
    loadChainGraph,
    loadVariants,
    loadNarratorNetwork,
    resetNetwork,
    resetVariants,
  };
}
