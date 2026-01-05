import { NextRequest, NextResponse } from "next/server";
import { fetchChainGraph } from "@/server/graph/queries";

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

  try {
    const graph = await fetchChainGraph(parsed.hadithId);
    if (!graph) {
      return NextResponse.json({ error: "Hadith not found in graph" }, { status: 404 });
    }
    return NextResponse.json(graph);
  } catch (error) {
    console.error("[api/graph/chain] Failed", error);
    return NextResponse.json({ error: "Unable to load chain graph" }, { status: 500 });
  }
}
