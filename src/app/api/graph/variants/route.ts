import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/graph/client";

function parseBody(body: unknown): { hadithId: number } | null {
  if (!body || typeof body !== "object") return null;
  const hadithId = Number((body as Record<string, unknown>).hadithId);
  if (!Number.isFinite(hadithId) || hadithId <= 0) return null;
  return { hadithId };
}

/**
 * Variant heuristic:
 * - Same Matn node -> "shared matn".
 * - Or shares at least one Narrator via chain -> "shared narrator".
 */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = parseBody(json);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const session = getSession({ defaultAccessMode: "READ" });
  try {
    const { hadithId } = parsed;

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

    if (!variants.length && matnVariants.records.length === 0 && narratorVariants.records.length === 0) {
      return NextResponse.json({ error: "Hadith not found in graph" }, { status: 404 });
    }

    return NextResponse.json({
      baseHadithId: hadithId,
      variants,
    });
  } catch (error) {
    console.error("[api/graph/variants] Failed", error);
    return NextResponse.json({ error: "Unable to load variants" }, { status: 500 });
  } finally {
    await session.close();
  }
}
