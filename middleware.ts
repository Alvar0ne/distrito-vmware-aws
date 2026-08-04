import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/adminSession";
import { NextRequest, NextResponse } from "next/server";

const publicAdminPaths = new Set(["/admin/login", "/api/admin/auth/login"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicAdminPaths.has(pathname)) return NextResponse.next();

  const authenticated = await verifyAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET ?? ""
  );

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Sesion administrativa requerida." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
