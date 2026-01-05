import { getSession } from "@/server/graph/client";
import { GraphApiEdge, GraphApiNode } from "@/server/graph/types";

export async function fetchChainGraph(hadithId: number) {
  const session = getSession({ defaultAccessMode: "READ" });
  try {
    const result = await session.run(
      `
        MATCH (h:Hadith {pgId: $hadithId})
        OPTIONAL MATCH (h)-[hc:HAS_CHAIN]->(c:Chain)
        OPTIONAL MATCH (c)-[s:STEP]->(n:Narrator)
        RETURN h, hc, c, s, n
      `,
      { hadithId },
    );

    if (result.records.length === 0) {
      return null;
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

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    };
  } finally {
    await session.close();
  }
}

export async function fetchVariants(hadithId: number) {
  const session = getSession({ defaultAccessMode: "READ" });
  try {
    const matnVariants = await session.run(
      `
        MATCH (h:Hadith {pgId: $hadithId})-[:HAS_MATN]->(m:Matn)<-[:HAS_MATN]-(v:Hadith)
        WHERE v.pgId <> h.pgId
        RETURN DISTINCT v.pgId AS id, v.displayNumber AS displayNumber, v.sourceName AS source
      `,
      { hadithId },
    );

    const narratorVariants = await session.run(
      `
        MATCH (h:Hadith {pgId: $hadithId})-[:HAS_CHAIN]->(:Chain)-[:STEP]->(n:Narrator)
        MATCH (v:Hadith)-[:HAS_CHAIN]->(:Chain)-[:STEP]->(n)
        WHERE v.pgId <> h.pgId
        RETURN DISTINCT v.pgId AS id, v.displayNumber AS displayNumber, v.sourceName AS source
        LIMIT 20
      `,
      { hadithId },
    );

    const seen = new Set<number>();
    const variants: Array<{ hadithId: number; displayNumber: string; source: string; similarityReason: string }> = [];

    for (const record of matnVariants.records) {
      const id = record.get("id") as number;
      if (seen.has(id)) continue;
      seen.add(id);
      variants.push({
        hadithId: id,
        displayNumber: record.get("displayNumber") ?? String(id),
        source: record.get("source") ?? "Unknown",
        similarityReason: "shared matn",
      });
    }

    for (const record of narratorVariants.records) {
      const id = record.get("id") as number;
      if (seen.has(id)) continue;
      seen.add(id);
      variants.push({
        hadithId: id,
        displayNumber: record.get("displayNumber") ?? String(id),
        source: record.get("source") ?? "Unknown",
        similarityReason: "shared narrator",
      });
    }

    return {
      variants,
      hasMatch: matnVariants.records.length > 0 || narratorVariants.records.length > 0,
    };
  } finally {
    await session.close();
  }
}

export async function fetchNarratorNetwork(narratorId: number, depth: number) {
  const session = getSession({ defaultAccessMode: "READ" });
  try {
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
      return null;
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

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    };
  } finally {
    await session.close();
  }
}

export async function fetchAnswerGraph(hadithIds: number[]) {
  const filtered = hadithIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!filtered.length) return null;
  const session = getSession({ defaultAccessMode: "READ" });
  try {
    const result = await session.run(
      `
        MATCH (h:Hadith)
        WHERE h.pgId IN $hadithIds
        OPTIONAL MATCH (h)-[r]->(n)
        WHERE NOT n:Chain AND NOT n:Narrator
        OPTIONAL MATCH (n)-[r2]->(m)
        WHERE (n:Grade AND m:Scholar)
           OR (n:Source AND m:Author)
           OR (n:Book AND m:Source)
           OR (n:Chapter AND m:Book)
        RETURN h, r, n, r2, m
      `,
      { hadithIds: filtered },
    );

    if (result.records.length === 0) {
      return null;
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
      const n = record.get("n");
      const m = record.get("m");
      const r = record.get("r");
      const r2 = record.get("r2");

      if (h) {
        const id = h.properties.key || `Hadith:${h.properties.pgId}`;
        const label = h.properties.displayLabel ?? `Hadith ${h.properties.pgId}`;
        addNode(id, label, "Hadith");
      }
      if (n) {
        const label = n.labels?.[0] ?? "Node";
        const id = n.properties.key || `${label}:${n.properties.pgId ?? n.identity?.toString()}`;
        const display =
          n.properties.name ||
          n.properties.title ||
          n.properties.identifier ||
          n.properties.label ||
          label;
        addNode(id, display ?? label, label);
      }
      if (m) {
        const label = m.labels?.[0] ?? "Node";
        const id = m.properties.key || `${label}:${m.properties.pgId ?? m.identity?.toString()}`;
        const display =
          m.properties.name ||
          m.properties.title ||
          m.properties.identifier ||
          m.properties.label ||
          label;
        addNode(id, display ?? label, label);
      }
      if (r && h && n) {
        const from = h.properties.key || `Hadith:${h.properties.pgId}`;
        const to = n.properties.key || `${n.labels?.[0] ?? "Node"}:${n.properties.pgId ?? n.identity?.toString()}`;
        const eid = r.identity ? r.identity.toString() : `${from}->${to}:${r.type}`;
        addEdge(eid, from, to, r.type);
      }
      if (r2 && n && m) {
        const from = n.properties.key || `${n.labels?.[0] ?? "Node"}:${n.properties.pgId ?? n.identity?.toString()}`;
        const to = m.properties.key || `${m.labels?.[0] ?? "Node"}:${m.properties.pgId ?? m.identity?.toString()}`;
        const eid = r2.identity ? r2.identity.toString() : `${from}->${to}:${r2.type}`;
        addEdge(eid, from, to, r2.type);
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values()),
    };
  } finally {
    await session.close();
  }
}
