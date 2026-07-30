import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleAuthorizationCode,
  getGoogleAuthConfig,
  GOOGLE_OAUTH_COOKIE_NAME,
  GoogleSignInError,
  signInWithGoogleIdentity,
  verifyGoogleOAuthState,
} from "@/lib/google-oauth";
import { getUserSessionSecret, startUserSession } from "@/lib/user-auth";

function loginRedirect(request: NextRequest, error: string, from = "/account") {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  url.searchParams.set("from", from);
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", {
    expires: new Date(0),
    path: "/api/auth/google",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const [config, secret] = await Promise.all([
    Promise.resolve(getGoogleAuthConfig()),
    getUserSessionSecret(),
  ]);
  if (!config || !secret) return loginRedirect(request, "google-disabled");

  const oauth = verifyGoogleOAuthState(
    request.cookies.get(GOOGLE_OAUTH_COOKIE_NAME)?.value,
    secret,
  );
  if (!oauth) return loginRedirect(request, "google-state");

  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError || !state || state !== oauth.state || !code) {
    return loginRedirect(request, providerError === "access_denied" ? "google-cancelled" : "google-state", oauth.from);
  }

  try {
    const claims = await exchangeGoogleAuthorizationCode(
      config,
      code,
      oauth.verifier,
      oauth.nonce,
    );
    const user = await signInWithGoogleIdentity(claims);
    await startUserSession(user.id);

    const response = NextResponse.redirect(new URL(oauth.from, config.appUrl));
    response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, "", {
      expires: new Date(0),
      path: "/api/auth/google",
    });
    return response;
  } catch (error) {
    console.error("[google-auth] sign-in failed", {
      code: error instanceof GoogleSignInError ? error.code : "unexpected",
    });
    const errorCode =
      error instanceof GoogleSignInError
        ? error.code === "account-conflict"
          ? "google-account-conflict"
          : error.code === "email-not-authoritative"
            ? "google-email-verification"
            : "google-invalid"
        : "google-failed";
    return loginRedirect(request, errorCode, oauth.from);
  }
}
