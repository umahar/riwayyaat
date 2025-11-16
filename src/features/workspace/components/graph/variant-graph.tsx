import { useMemo } from "react";
import dynamic from "next/dynamic";
import { VariantsData } from "@/features/workspace/hooks/use-graph";

const ForceGraph2D = dynamic(() => import("react-force-graph").then((mod) => mod.ForceGraph2D), {
  ssr: false,
});

type VariantGraphProps = {
  data: VariantsData;
};

export function VariantGraph({ data }: VariantGraphProps) {
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
    <div className="h-64 w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)]">
      <ForceGraph2D
        graphData={graphData}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          const label = node.name || node.id;
          ctx.fillStyle = node.type === "Hadith" ? "#2563eb" : "#22c55e";
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, 6, 0, 2 * Math.PI, false);
          ctx.fill();
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#e5e7eb";
          ctx.fillText(label, node.x! + 8, node.y! + 4);
        }}
        linkColor={(link: any) => (link.type === "shared matn" ? "#22c55e" : "#f59e0b")}
        linkLabel={(link: any) => link.type}
      />
    </div>
  );
}
