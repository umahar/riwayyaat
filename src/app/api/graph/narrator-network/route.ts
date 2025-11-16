import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/graph/client";
import { GraphApiNode, GraphApiEdge } from "@/server/graph/types";

function parseBody(body: unknown): { narratorId: number; depth: number } | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const narratorId = Number(data.narratorId);
  if (!Number.isFinite(narratorId) || narratorId <= 0) return null;
  const depthRaw = Number(data.depth);
  const depth = Number.isFinite(depthRaw) && depthRaw > 0 ? Math.min(Math.trunc(depthRaw), 3) : 2;
  return { narratorId, depth };
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = parseBody(json);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { narratorId, depth } = parsed;
  const session = getSession({ defaultAccessMode: "READ" });
  try {
    // Ego-network: narrators connected via shared chains up to depth steps.
    const result = await session.run(
      `
        MATCH (seed:Narrator {pgId: $narratorId})
        OPTIONAL MATCH p=(seed)<-[:STEP]-(:Chain)-[:STEP*1..${depth}]->(other:Narrator)
        WITH seed, p
        UNWIND (CASE WHEN p IS NULL THEN [] ELSE nodes(p) END) AS node
        UNWIND (CASE WHEN p IS NULL THEN [] ELSE relationships(p) END) AS rel
        WITH seed, collect(DISTINCT node) AS nodes, collect(DISTINCT rel) AS rels
        RETURN seed, nodes, rels
      `,
      { narratorId },
    );

    if (result.records.length === 0) {
      return NextResponse.json({ error: "Narrator not found in graph" }, { status: 404 });
    }

    const nodesMap = new Map<string, GraphApiNode>();
    const edgesMap = new Map<string, GraphApiEdge>();

    const addNode = (id: string, label: string, type: string) => {
      if (!nodesMap.has(id)) nodesMap.set(id, { id, label, type });
    };
    const addEdge = (id: string, from: string, to: string, type: string, extra?: Record<string, unknown>) => {
      if (!edgesMap.has(id)) edgesMap.set(id, { id, from, to, type, ...(extra ?? {}) });
    };

    const record = result.records[0];
    const seed = record.get("seed");
    const nodes = record.get("nodes") as any[];
    const rels = record.get("rels") as any[];

    if (seed) {
      const id = seed.properties.key || `Narrator:${seed.properties.pgId}`;
      addNode(id, seed.properties.name ?? `Narrator ${seed.properties.pgId}`, "Narrator");
    }

    for (const node of nodes ?? []) {
      const label = node.labels?.[0] ?? "Node";
      const id = node.properties.key || `${label}:${node.properties.pgId ?? node.identity?.toString()}`;
      const display =
        label === "Narrator"
          ? node.properties.name ?? `Narrator ${node.properties.pgId}`
          : label === "Chain"
            ? node.properties.label ?? "Chain"
            : label;
      addNode(id, display, label);
    }

    for (const rel of rels ?? []) {
      const type = rel.type ?? "REL";
      const from = rel.start?.properties?.key || rel.start?.identity?.toString();
      const to = rel.end?.properties?.key || rel.end?.identity?.toString();
      if (!from || !to) continue;
      const id = rel.identity ? rel.identity.toString() : `${from}->${to}:${type}`;
      addEdge(id, from, to, type, { position: rel.properties?.position ?? null });
    }

    return NextResponse.json({
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    });
  } catch (error) {
    console.error("[api/graph/narrator-network] Failed", error);
    return NextResponse.json({ error: "Unable to load narrator network" }, { status: 500 });
  } finally {
    await session.close();
  }
}
