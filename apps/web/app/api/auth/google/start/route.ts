import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  getGoogleAuthConfig,
  GOOGLE_OAUTH_COOKIE_NAME,
} from "@/lib/google-oauth";
import { getUserSessionSecret } from "@/lib/user-auth";

export async function GET(request: NextRequest) {
  const [config, secret] = await Promise.all([
    Promise.resolve(getGoogleAuthConfig()),
    getUserSessionSecret(),
  ]);

  if (!config || !secret) {
    return NextResponse.redirect(new URL("/login?error=google-disabled", request.url));
  }

  const oauth = createGoogleOAuthState(secret, request.nextUrl.searchParams.get("from"));
  const response = NextResponse.redirect(
    buildGoogleAuthorizationUrl(config, oauth.payload, oauth.codeChallenge),
  );
  response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, oauth.cookieValue, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/api/auth/google",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
