import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/server/auth/admin-auth";
import { fetchAdminLookups } from "@/features/admin/server/hadith-admin-service";

export async function GET(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const data = await fetchAdminLookups();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[api/admin/lookups] Failed to load lookups", error);
    return NextResponse.json({ error: "Unable to load lookups" }, { status: 500 });
  }
}
