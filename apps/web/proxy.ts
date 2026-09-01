import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { validateSessionSecret } from "@/lib/session-secret";
import { isPrivateBrowserRoute } from "@/lib/private-routes";

const LOGIN_PATH = "/admin/login";
const SETUP_PATH = "/admin/setup";

const AUTHENTICATED_SESSION_COOKIES = [
  "csn_admin",
  "csn_moderator",
  "csn_promoter",
  "csn_user",
] as const;

function buildContentSecurityPolicy(
  nonce: string,
  pathname: string,
  hasAuthenticatedSession: boolean,
) {
  const developmentScriptPolicy =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const developmentConnectPolicy =
    process.env.NODE_ENV === "development" ? " ws: http:" : "";
  const privateContext =
    hasAuthenticatedSession || isPrivateBrowserRoute(pathname);
  const thirdPartyScripts = privateContext
    ? ""
    : " https://www.googletagmanager.com https://pagead2.googlesyndication.com https://connect.facebook.net";
  const thirdPartyConnections = privateContext
    ? ""
    : " https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.facebook.com https://connect.facebook.net";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptPolicy}${thirdPartyScripts}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${developmentConnectPolicy}${thirdPartyConnections}`,
    privateContext
      ? "frame-src 'none'"
      : "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

function secureResponse(response: NextResponse, policy: string) {
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const hasAuthenticatedSession = AUTHENTICATED_SESSION_COOKIES.some(
    (cookieName) => req.cookies.has(cookieName),
  );
  const contentSecurityPolicy = buildContentSecurityPolicy(
    nonce,
    pathname,
    hasAuthenticatedSession,
  );
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-csn-pathname", pathname);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  if (
    !pathname.startsWith("/admin") ||
    pathname === LOGIN_PATH ||
    pathname === SETUP_PATH
  ) {
    return secureResponse(
      NextResponse.next({ request: { headers: requestHeaders } }),
      contentSecurityPolicy,
    );
  }

  const adminSessionSecret = validateSessionSecret(process.env.ADMIN_SESSION_SECRET, 32).secret;
  if (!adminSessionSecret) {
    return secureResponse(
      new NextResponse("Admin access disabled - set a strong ADMIN_SESSION_SECRET.", {
        status: 503,
      }),
      contentSecurityPolicy,
    );
  }

  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  if (await verifyAdminSessionToken(cookie?.value, adminSessionSecret)) {
    return secureResponse(
      NextResponse.next({ request: { headers: requestHeaders } }),
      contentSecurityPolicy,
    );
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set("from", pathname);
  return secureResponse(NextResponse.redirect(loginUrl), contentSecurityPolicy);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
