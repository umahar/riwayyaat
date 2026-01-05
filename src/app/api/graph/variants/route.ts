import { NextRequest, NextResponse } from "next/server";
import { fetchVariants } from "@/server/graph/queries";

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

  try {
    const { hadithId } = parsed;
    const { variants, hasMatch } = await fetchVariants(hadithId);
    if (!variants.length && !hasMatch) {
      return NextResponse.json({ error: "Hadith not found in graph" }, { status: 404 });
    }

    return NextResponse.json({
      baseHadithId: hadithId,
      variants,
    });
  } catch (error) {
    console.error("[api/graph/variants] Failed", error);
    return NextResponse.json({ error: "Unable to load variants" }, { status: 500 });
  }
}
