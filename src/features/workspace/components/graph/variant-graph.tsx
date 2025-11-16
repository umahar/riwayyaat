import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { VariantsData } from "@/features/workspace/hooks/use-graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d").then((mod) => mod.default), {
  ssr: false,
});

type VariantGraphProps = {
  data: VariantsData;
};

export function VariantGraph({ data }: VariantGraphProps) {
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
    const nodes = [
      { id: `Hadith:${data.baseHadithId}`, name: `Base #${data.baseHadithId}`, type: "Hadith" },
      ...data.variants.map((v) => ({
        id: `Hadith:${v.hadithId}`,
        name: `${v.source} — ${v.displayNumber}`,
        type: "Variant",
        reason: v.similarityReason,
      })),
    ];
    const links = data.variants.map((v) => ({
      source: `Hadith:${data.baseHadithId}`,
      target: `Hadith:${v.hadithId}`,
      type: v.similarityReason,
    }));
    return { nodes, links };
  }, [data]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)]"
    >
      <ForceGraph2D
        width={size.width || undefined}
        height={size.height || undefined}
        graphData={graphData}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          const label = node.name || node.id;
          const nodeColor = node.type === "Hadith" ? "#2563eb" : "#16a34a";
          ctx.fillStyle = nodeColor;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, 7, 0, 2 * Math.PI, false);
          ctx.fill();
          ctx.font = "12px Inter, sans-serif";
          ctx.fillStyle = "#0f172a";
          ctx.fillText(label, node.x! + 10, node.y! + 4);
        }}
        linkColor={(link: any) => (link.type === "shared matn" ? "#16a34a" : "#d97706")}
        linkLabel={(link: any) => link.type}
      />
    </div>
  );
}
