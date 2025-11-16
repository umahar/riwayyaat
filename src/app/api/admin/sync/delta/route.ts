import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/server/auth/admin-auth";
import { processHadithSyncBatch } from "@/server/sync/hadith-sync";

export async function POST(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const limit = Number((body as { limit?: unknown }).limit);
  const batchLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.trunc(limit), 200) : 50;
  try {
    await processHadithSyncBatch(batchLimit);
    return NextResponse.json({ ok: true, processed: batchLimit });
  } catch (error) {
    console.error("[api/admin/sync/delta] Failed", error);
    return NextResponse.json({ error: "Unable to process sync batch" }, { status: 500 });
  }
}
