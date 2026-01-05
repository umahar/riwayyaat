import { NextRequest, NextResponse } from "next/server";
import { fetchNarratorNetwork } from "@/server/graph/queries";

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
  try {
    const graph = await fetchNarratorNetwork(narratorId, depth);
    if (!graph) {
      return NextResponse.json({ error: "Narrator not found in graph" }, { status: 404 });
    }
    return NextResponse.json(graph);
  } catch (error) {
    console.error("[api/graph/narrator-network] Failed", error);
    return NextResponse.json({ error: "Unable to load narrator network" }, { status: 500 });
  }
}
