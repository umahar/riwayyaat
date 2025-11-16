import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, clearAdminSession, isAdminRequestAuthorized, setAdminSession } from "@/server/auth/admin-auth";

export async function GET(request: NextRequest) {
  const authenticated = await isAdminRequestAuthorized(request);
  return NextResponse.json({ authenticated });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body?.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_TOKEN is not configured" }, { status: 500 });
  }
  if (token !== expected) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true });
  await setAdminSession(response, token);
  return response;
}

export async function DELETE(request: NextRequest) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;
  const response = NextResponse.json({ ok: true });
  clearAdminSession(response);
  return response;
}
