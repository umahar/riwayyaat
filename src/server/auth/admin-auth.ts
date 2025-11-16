import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "riwayyaat_admin_session";

let cachedHash: string | null | undefined;

async function hashToken(value: string): Promise<string> {
  const buffer = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function expectedHash(): Promise<string | null> {
  if (cachedHash !== undefined) return cachedHash;
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    console.warn("[auth] ADMIN_TOKEN is not set; admin routes will reject all requests");
    cachedHash = null;
    return null;
  }
  cachedHash = await hashToken(token);
  return cachedHash;
}

function extractBearer(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const headerToken = request.headers.get("x-admin-token");
  if (headerToken) return headerToken.trim();
  const cookieToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return cookieToken ?? null;
}

export async function isAdminRequestAuthorized(request: NextRequest): Promise<boolean> {
  const expected = await expectedHash();
  if (!expected) return false;
  const candidate = extractBearer(request);
  if (!candidate) return false;
  if (candidate === expected) return true; // cookie already stores hash
  const candidateHash = await hashToken(candidate);
  return candidateHash === expected;
}

export async function setAdminSession(response: NextResponse, rawToken: string) {
  const hashed = await hashToken(rawToken);
  response.cookies.set(ADMIN_COOKIE_NAME, hashed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6, // 6 hours
  });
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function assertAdmin(
  request: NextRequest,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const authorized = await isAdminRequestAuthorized(request);
  if (authorized) return { ok: true };
  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}
