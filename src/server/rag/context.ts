import { HadithInsight } from "@/features/hadith/types";
import { RagContextEntry, RagResult, RagGraph } from "@/types/rag";
import { RagGraphContext } from "@/server/rag/graph-context";

type HadithMap = Map<number, HadithInsight>;

function mapHadithExtra(hadith?: HadithInsight) {
  if (!hadith) return undefined;
  return {
    displayLabel: hadith.details.displayLabel,
    location: hadith.details.location,
    grading: hadith.details.grading,
    author: hadith.details.author,
    identifiers: hadith.identifiers?.map((entry) => ({
      schemeKey: entry.schemeKey,
      identifier: entry.identifier,
      isPrimary: entry.isPrimary ?? undefined,
    })),
    chain: hadith.chain.map((node) => ({
      name: node.name,
      descriptor: node.descriptor,
      lifespan: node.lifespan,
      type: node.type,
      reliability: node.reliabilityDetail?.title,
      transmissionMethod: node.transmissionMethodDetail?.title,
    })),
    narrationLevel: hadith.narrationLevel,
    chainTypes: hadith.chainTypes,
    sourceTypes: hadith.sourceTypes,
  };
}

export function buildRagContext(
  results: RagResult[],
  hadithsById: HadithMap,
  graphsById?: Map<number, RagGraphContext>,
  provenance?: RagGraph | null,
): RagContextEntry[] {
  const provenanceSummary = summarizeProvenance(provenance ?? undefined);
  return results.map((result, index) => {
    const hadith = hadithsById.get(result.hadithId);
    const graph = graphsById?.get(result.hadithId);
    return {
      hadithId: result.hadithId,
      displayNumber: result.displayNumber,
      source: result.source.name,
      book: result.book?.name ?? null,
      chapter: result.chapter?.name ?? null,
      matn: result.matn,
      tags: result.tags,
      grades: result.grades.map((g) => ({
        gradeTitle: g.grade.title,
        scholar: g.scholar.name,
        isPrimary: g.isPrimary ?? undefined,
      })),
      extra: mapHadithExtra(hadith),
      graph,
      provenance: index === 0 ? provenanceSummary : undefined,
    };
  });
}

function summarizeProvenance(graph?: RagGraph) {
  if (!graph?.nodes?.length) return undefined;
  const nodeTypes: Record<string, number> = {};
  const edgeTypes: Record<string, number> = {};
  graph.nodes.forEach((node) => {
    const key = node.type ?? "Node";
    nodeTypes[key] = (nodeTypes[key] ?? 0) + 1;
  });
  graph.edges?.forEach((edge) => {
    const key = edge.type ?? "REL";
    edgeTypes[key] = (edgeTypes[key] ?? 0) + 1;
  });
  const sampleNodes = graph.nodes
    .map((node) => node.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 12);
  return { nodeTypes, edgeTypes, sampleNodes };
}
