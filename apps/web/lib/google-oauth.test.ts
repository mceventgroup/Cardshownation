import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleAuthorizationUrl,
  canLinkGoogleEmail,
  createGoogleOAuthState,
  isGoogleAuthoritativeForEmail,
  verifyGoogleOAuthState,
} from "./google-oauth";

const SECRET = "a-secure-test-secret-that-is-long-enough";

test("Google OAuth state is signed and rejects tampering", () => {
  const created = createGoogleOAuthState(SECRET, "/account?tab=alerts");
  const verified = verifyGoogleOAuthState(created.cookieValue, SECRET);

  assert.equal(verified?.state, created.payload.state);
  assert.equal(verified?.nonce, created.payload.nonce);
  assert.equal(verified?.from, "/account?tab=alerts");
  assert.equal(
    verifyGoogleOAuthState(`${created.cookieValue.slice(0, -1)}x`, SECRET),
    null,
  );
});

test("Google authorization requests force account selection and use PKCE", () => {
  const created = createGoogleOAuthState(SECRET, "/account");
  const url = buildGoogleAuthorizationUrl(
    {
      appUrl: "https://cardshownation.com",
      clientId: "client.apps.googleusercontent.com",
      clientSecret: "secret",
      redirectUri: "https://cardshownation.com/api/auth/google/callback",
    },
    created.payload,
    created.codeChallenge,
  );

  assert.equal(url.searchParams.get("prompt"), "select_account");
  assert.equal(url.searchParams.get("state"), created.payload.state);
  assert.equal(url.searchParams.get("nonce"), created.payload.nonce);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("code_challenge"));
});

test("Google is authoritative only for Gmail or hosted Workspace email", () => {
  assert.equal(isGoogleAuthoritativeForEmail({
    email: "fan@gmail.com",
    emailVerified: true,
    hostedDomain: null,
  }), true);
  assert.equal(isGoogleAuthoritativeForEmail({
    email: "fan@cardshop.example",
    emailVerified: true,
    hostedDomain: "cardshop.example",
  }), true);
  assert.equal(isGoogleAuthoritativeForEmail({
    email: "fan@yahoo.com",
    emailVerified: true,
    hostedDomain: null,
  }), false);
});

test("a separately verified Card Show Nation email can be linked to Google", () => {
  const externalGoogleAddress = {
    email: "fan@yahoo.com",
    emailVerified: true,
    hostedDomain: null,
  };

  assert.equal(canLinkGoogleEmail(externalGoogleAddress, false), false);
  assert.equal(canLinkGoogleEmail(externalGoogleAddress, true), true);
});
