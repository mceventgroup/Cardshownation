import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
const LOGIN_PATH = "/admin/login";
const SETUP_PATH = "/admin/setup";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    !pathname.startsWith("/admin") ||
    pathname === LOGIN_PATH ||
    pathname === SETUP_PATH
  ) {
    return NextResponse.next();
  }

  if (!ADMIN_SESSION_SECRET) {
    return new NextResponse("Admin access disabled - set ADMIN_SESSION_SECRET.", {
      status: 503,
    });
  }

  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  if (await verifyAdminSessionToken(cookie?.value, ADMIN_SESSION_SECRET)) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
