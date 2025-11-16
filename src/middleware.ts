import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/server/auth/admin-auth";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminRoute && !isAdminApi) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const authorized = await isAdminRequestAuthorized(request);
  if (authorized) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redirectUrl = new URL("/admin/login", request.url);
  redirectUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
