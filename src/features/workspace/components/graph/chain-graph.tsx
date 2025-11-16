import { useMemo } from "react";
import dynamic from "next/dynamic";
import { GraphData } from "@/features/workspace/hooks/use-graph";

// react-force-graph needs window; load dynamically client-side.
const ForceGraph2D = dynamic(() => import("react-force-graph").then((mod) => mod.ForceGraph2D), {
  ssr: false,
});

type ChainGraphProps = {
  data: GraphData;
  onNarratorSelect?: (narratorId: number) => void;
};

export function ChainGraph({ data, onNarratorSelect }: ChainGraphProps) {
  const graphData = useMemo(() => {
    return {
      nodes: data.nodes.map((n) => ({
        id: n.id,
        name: n.label,
        type: n.type,
      })),
      links: data.edges.map((e) => ({
        source: e.from,
        target: e.to,
        type: e.type,
        position: e.position,
      })),
    };
  }, [data]);

  const handleNodeClick = (node: any) => {
    if (node?.type === "Narrator" && node.id) {
      const pgId = Number(String(node.id).split(":").pop());
      if (Number.isFinite(pgId)) onNarratorSelect?.(pgId);
    }
  };

  return (
    <div className="h-80 w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)]">
      <ForceGraph2D
        graphData={graphData}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          const label = node.name || node.id;
          ctx.fillStyle = node.type === "Narrator" ? "#10b981" : node.type === "Hadith" ? "#2563eb" : "#6b7280";
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, 6, 0, 2 * Math.PI, false);
          ctx.fill();
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#e5e7eb";
          ctx.fillText(label, node.x! + 8, node.y! + 4);
        }}
        linkColor={() => "#94a3b8"}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
