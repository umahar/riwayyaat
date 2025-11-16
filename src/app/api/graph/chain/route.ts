import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/graph/client";
import { GraphApiNode, GraphApiEdge } from "@/server/graph/types";

type ChainRequest = { hadithId?: number };

function parseBody(body: unknown): { hadithId: number } | null {
  if (!body || typeof body !== "object") return null;
  const hadithId = Number((body as Record<string, unknown>).hadithId);
  if (!Number.isFinite(hadithId) || hadithId <= 0) return null;
  return { hadithId };
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = parseBody(json);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const session = getSession({ defaultAccessMode: "READ" });
  try {
    const result = await session.run(
      `
        MATCH (h:Hadith {pgId: $hadithId})
        OPTIONAL MATCH (h)-[hc:HAS_CHAIN]->(c:Chain)
        OPTIONAL MATCH (c)-[s:STEP]->(n:Narrator)
        RETURN h, hc, c, s, n
      `,
      { hadithId: parsed.hadithId },
    );

    if (result.records.length === 0) {
      return NextResponse.json({ error: "Hadith not found in graph" }, { status: 404 });
    }

    const nodesMap = new Map<string, GraphApiNode>();
    const edgesMap = new Map<string, GraphApiEdge>();

    const addNode = (id: string, label: string, type: string) => {
      if (!nodesMap.has(id)) nodesMap.set(id, { id, label, type });
    };
    const addEdge = (id: string, from: string, to: string, type: string, extra?: Record<string, unknown>) => {
      if (!edgesMap.has(id)) edgesMap.set(id, { id, from, to, type, ...(extra ?? {}) });
    };

    for (const record of result.records) {
      const h = record.get("h");
      const c = record.get("c");
      const n = record.get("n");
      const hc = record.get("hc");
      const s = record.get("s");

      if (h) {
        const id = h.properties.key || `Hadith:${h.properties.pgId}`;
        addNode(id, h.properties.displayLabel ?? `Hadith ${h.properties.pgId}`, "Hadith");
      }
      if (c) {
        const id = c.properties.key || `Chain:${c.properties.pgId}`;
        addNode(id, c.properties.label ?? "Chain", "Chain");
      }
      if (n) {
        const id = n.properties.key || `Narrator:${n.properties.pgId}`;
        addNode(id, n.properties.name ?? `Narrator ${n.properties.pgId}`, "Narrator");
      }
      if (hc && h && c) {
        const from = h.properties.key || `Hadith:${h.properties.pgId}`;
        const to = c.properties.key || `Chain:${c.properties.pgId}`;
        const eid = hc.identity ? hc.identity.toString() : `${from}->${to}:HAS_CHAIN`;
        addEdge(eid, from, to, "HAS_CHAIN");
      }
      if (s && c && n) {
        const from = c.properties.key || `Chain:${c.properties.pgId}`;
        const to = n.properties.key || `Narrator:${n.properties.pgId}`;
        const eid = s.identity ? s.identity.toString() : `${from}->${to}:STEP`;
        addEdge(eid, from, to, "STEP", { position: s.properties?.position ?? null });
      }
    }

    return NextResponse.json({
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    });
  } catch (error) {
    console.error("[api/graph/chain] Failed", error);
    return NextResponse.json({ error: "Unable to load chain graph" }, { status: 500 });
  } finally {
    await session.close();
  }
}
