import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/server/auth/admin-auth";
import { runEvaluation } from "@/server/eval/runner";

export async function POST(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const asNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.trunc(num) : undefined;
  };
  const datasetPath =
    typeof (body as { datasetPath?: unknown }).datasetPath === "string"
      ? (body as { datasetPath?: string }).datasetPath
      : undefined;
  const limit = asNumber((body as { limit?: unknown }).limit);
  const topK = asNumber((body as { topK?: unknown }).topK);
  const skipAnswers = Boolean((body as { skipAnswers?: unknown }).skipAnswers);
  const retrievalModeRaw = (body as { retrievalMode?: unknown }).retrievalMode;
  const retrievalMode =
    retrievalModeRaw === "pg" || retrievalModeRaw === "kg" || retrievalModeRaw === "hybrid"
      ? retrievalModeRaw
      : "kg";
  try {
    const result = await runEvaluation({
      limit,
      topK,
      datasetPath,
      generateAnswers: skipAnswers ? false : undefined,
      retrievalMode,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[api/admin/evaluation/run] failed", error);
    return NextResponse.json({ error: "Unable to run evaluation" }, { status: 500 });
  }
}
