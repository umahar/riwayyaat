import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/server/auth/admin-auth";
import {
  AdminInputError,
  getAdminHadith,
  softDeleteHadith,
  updateAdminHadith,
} from "@/features/admin/server/hadith-admin-service";
import { validateHadithPayload } from "@/features/admin/server/validate-hadith";
import { enqueueHadithSync } from "@/server/sync/hadith-sync";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const record = await getAdminHadith(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: record });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const rawBody = await request.json().catch(() => ({}));
  const { data, errors } = validateHadithPayload(rawBody);
  if (!data || errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }
  try {
    const updated = await updateAdminHadith(id, data);
    await enqueueHadithSync(id, { graph: true, embedding: true });
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof AdminInputError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if ((error as { code?: string }).code === "23503") {
      return NextResponse.json({ error: "Select existing lookup values for all related fields." }, { status: 400 });
    }
    console.error("[api/admin/hadith:id] Failed to update hadith", error);
    return NextResponse.json({ error: "Unable to update hadith" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    await softDeleteHadith(id);
    await enqueueHadithSync(id, { graph: true, embedding: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/admin/hadith:id] Failed to delete hadith", error);
    return NextResponse.json({ error: "Unable to delete hadith" }, { status: 500 });
  }
}
