import { NextRequest, NextResponse } from "next/server";
import { fetchAnswerGraph } from "@/server/graph/queries";

type AnswerGraphRequest = { hadithIds?: number[] };

function parseBody(body: unknown): { hadithIds: number[] } | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as AnswerGraphRequest).hadithIds;
  const ids = Array.isArray(raw)
    ? raw.map((value) => Number(value)).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  return ids.length ? { hadithIds: ids } : null;
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = parseBody(json);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const graph = await fetchAnswerGraph(parsed.hadithIds);
    if (!graph || graph.nodes.length === 0) {
      return NextResponse.json({ error: "Graph not available for these citations" }, { status: 404 });
    }
    return NextResponse.json(graph);
  } catch (error) {
    console.error("[api/graph/answer] Failed", error);
    return NextResponse.json({ error: "Unable to load answer graph" }, { status: 500 });
  }
}
