import { useEffect, useMemo, useRef, useState } from "react";
import { GraphData } from "@/features/workspace/hooks/use-graph";
import dynamic from "next/dynamic";

// Force 2D-only bundle to avoid AFRAME/global usage and load client-side.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d").then((mod) => mod.default), {
  ssr: false,
});

type ChainGraphProps = {
  data: GraphData;
  onNarratorSelect?: (narratorId: number) => void;
};

export function ChainGraph({ data, onNarratorSelect }: ChainGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      setSize({ width: clientWidth, height: clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)]"
    >
      <ForceGraph2D
        width={size.width || undefined}
        height={size.height || undefined}
        graphData={graphData}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          const label = node.name || node.id;
          const nodeColor =
            node.type === "Narrator" ? "#0f766e" : node.type === "Hadith" ? "#2563eb" : "#475569";
          ctx.fillStyle = nodeColor;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, 7, 0, 2 * Math.PI, false);
          ctx.fill();
          ctx.font = "12px Inter, sans-serif";
          ctx.fillStyle = "#0f172a";
          ctx.fillText(label, node.x! + 10, node.y! + 4);
        }}
        linkColor={() => "#cbd5e1"}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
