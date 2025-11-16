import { useMemo } from "react";
import dynamic from "next/dynamic";
import { GraphData } from "@/features/workspace/hooks/use-graph";

const ForceGraph2D = dynamic(() => import("react-force-graph").then((mod) => mod.ForceGraph2D), {
  ssr: false,
});

type NarratorNetworkGraphProps = {
  data: GraphData;
};

export function NarratorNetworkGraph({ data }: NarratorNetworkGraphProps) {
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
      })),
    };
  }, [data]);

  return (
    <div className="h-64 w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)]">
      <ForceGraph2D
        graphData={graphData}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          const label = node.name || node.id;
          ctx.fillStyle = "#10b981";
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, 6, 0, 2 * Math.PI, false);
          ctx.fill();
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#e5e7eb";
          ctx.fillText(label, node.x! + 8, node.y! + 4);
        }}
        linkColor={() => "#94a3b8"}
      />
    </div>
  );
}
