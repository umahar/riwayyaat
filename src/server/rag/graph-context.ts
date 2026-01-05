import { fetchChainGraph, fetchVariants } from "@/server/graph/queries";
import { GraphApiEdge, GraphApiNode } from "@/server/graph/types";

export type RagGraphContext = {
  hadithId: number;
  chain?: string[];
  variants?: Array<{ hadithId: number; source: string; displayNumber: string; reason: string }>;
};

function buildChainSummary(graph?: { nodes: GraphApiNode[]; edges: GraphApiEdge[] }) {
  if (!graph?.nodes?.length || !graph?.edges?.length) return [];
  const nodeLabels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const steps = graph.edges
    .filter((edge) => edge.type === "STEP")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((edge) => nodeLabels.get(edge.to))
    .filter(Boolean) as string[];
  return steps;
}

export async function loadGraphContext(hadithIds: number[], limit = 2): Promise<Map<number, RagGraphContext>> {
  const selected = hadithIds.slice(0, Math.max(1, limit));
  const entries = await Promise.all(
    selected.map(async (hadithId) => {
      try {
        const [chainGraph, variants] = await Promise.all([
          fetchChainGraph(hadithId),
          fetchVariants(hadithId),
        ]);
        return {
          hadithId,
          chain: buildChainSummary(chainGraph ?? undefined),
          variants: variants.variants.slice(0, 6).map((variant) => ({
            hadithId: variant.hadithId,
            source: variant.source,
            displayNumber: variant.displayNumber,
            reason: variant.similarityReason,
          })),
        } satisfies RagGraphContext;
      } catch (error) {
        console.warn(`[rag] Unable to load graph context for hadith ${hadithId}`, error);
        return { hadithId } satisfies RagGraphContext;
      }
    }),
  );
  return new Map(entries.map((entry) => [entry.hadithId, entry]));
}
