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
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoverNode, setHoverNode] = useState<any | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

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

  useEffect(() => {
    if (!graphRef.current) return;
    const linkForce = graphRef.current.d3Force?.("link");
    if (linkForce?.distance) linkForce.distance(160);
    const charge = graphRef.current.d3Force?.("charge");
    if (charge?.strength) charge.strength(-180);
    if (graphRef.current.d3VelocityDecay) graphRef.current.d3VelocityDecay(0.92);
    if (graphRef.current.numDimensions) graphRef.current.numDimensions(2);
  }, [data]);

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

  const truncateLabel = (label: string, max = 30) => {
    if (!label) return "";
    return label.length > max ? `${label.slice(0, max - 1)}…` : label;
  };

  const zoom = (factor: number) => {
    if (!graphRef.current) return;
    const next = Math.max(0.5, Math.min(3, zoomLevel * factor));
    graphRef.current.zoom(next, 300);
    setZoomLevel(next);
  };

  const resetView = () => {
    if (!graphRef.current) return;
    setZoomLevel(1);
    graphRef.current.zoom(1, 300);
    graphRef.current.centerAt(0, 0, 400);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-64 w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] p-3 shadow-sm transition hover:shadow-md"
    >
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#2563eb]" /> Base hadith
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#16a34a]" /> Variant
        </span>
      </div>
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => zoom(1.2)}
          className="rounded-full bg-[var(--surface-card)] px-2 py-1 text-sm font-semibold text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-soft)] transition hover:bg-[var(--surface-card)]/80"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoom(0.8)}
          className="rounded-full bg-[var(--surface-card)] px-2 py-1 text-sm font-semibold text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-soft)] transition hover:bg-[var(--surface-card)]/80"
        >
          –
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded-full bg-[var(--surface-card)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--border-soft)] transition hover:bg-[var(--surface-card)]/80"
        >
          Reset
        </button>
      </div>
      <ForceGraph2D
        ref={graphRef}
        width={size.width || undefined}
        height={size.height || undefined}
        graphData={graphData}
        cooldownTicks={100}
        onNodeHover={(node) => setHoverNode(node || null)}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          const label = truncateLabel(node.name || node.id);
          const faded = hoverNode && hoverNode.id !== node.id;
          const nodeColor = node.type === "Hadith" ? "#2563eb" : "#16a34a";
          ctx.globalAlpha = faded ? 0.35 : 1;
          ctx.fillStyle = nodeColor;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, 7, 0, 2 * Math.PI, false);
          ctx.fill();
          ctx.font = "12px Inter, sans-serif";
          ctx.fillStyle = "#0f172a";
          ctx.fillText(label, node.x! + 10, node.y! + 4);
          ctx.globalAlpha = 1;
        }}
        linkColor={(link: any) => (link.type === "shared matn" ? "#16a34a" : "#d97706")}
        linkLabel={(link: any) => link.type}
      />
      {hoverNode && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-[var(--surface-card)] px-3 py-2 text-xs text-[var(--text-primary)] shadow">
          <p className="font-semibold">{hoverNode.name}</p>
          <p className="text-[var(--text-muted)] capitalize">{hoverNode.type?.toLowerCase()}</p>
        </div>
      )}
    </div>
  );
}
