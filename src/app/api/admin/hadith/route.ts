import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/server/auth/admin-auth";
import { AdminInputError, createAdminHadith, listAdminHadiths } from "@/features/admin/server/hadith-admin-service";
import { validateHadithPayload } from "@/features/admin/server/validate-hadith";
import { enqueueHadithSync } from "@/server/sync/hadith-sync";

export async function GET(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");
  const search = searchParams.get("search") ?? undefined;
  const book = searchParams.get("book") ?? undefined;
  const chapter = searchParams.get("chapter") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const narrator = searchParams.get("narrator") ?? undefined;
  const source = searchParams.get("source") ?? undefined;

  const result = await listAdminHadiths({
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
    search,
    book,
    chapter,
    tag,
    narrator,
    source,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;
  const rawBody = await request.json().catch(() => ({}));
  const { data, errors } = validateHadithPayload(rawBody);
  if (!data || errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }
  try {
    const created = await createAdminHadith(data);
    await enqueueHadithSync(created.id, { graph: true, embedding: true });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminInputError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if ((error as { code?: string }).code === "23503") {
      return NextResponse.json({ error: "Select existing lookup values for all related fields." }, { status: 400 });
    }
    console.error("[api/admin/hadith] Failed to create hadith", error);
    return NextResponse.json({ error: "Unable to create hadith" }, { status: 500 });
  }
}
