import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { Prisma } from "@csn/db";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { sanitizeLocalRedirectTarget } from "@/lib/url";
import { validateUserSessionSecret } from "@/lib/user-auth";

const GOOGLE_PROVIDER = "google";
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

export const GOOGLE_OAUTH_COOKIE_NAME = "csn_google_oauth";

type GoogleOAuthState = {
  exp: number;
  from: string;
  nonce: string;
  state: string;
  verifier: string;
  v: 1;
};

type GoogleIdentityClaims = {
  email: string;
  emailVerified: boolean;
  hostedDomain?: string | null;
  name?: string | null;
  nonce: string;
  subject: string;
};

type GoogleAuthConfig = {
  appUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type GoogleUserRow = {
  email: string;
  emailVerifiedAt: Date | null;
  id: string;
  role: "FAN" | "MODERATOR" | "ORGANIZER" | "ADMIN";
};

export class GoogleSignInError extends Error {
  code: "account-conflict" | "email-not-authoritative" | "invalid-identity";

  constructor(code: GoogleSignInError["code"], message: string) {
    super(message);
    this.name = "GoogleSignInError";
    this.code = code;
  }
}

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function signStatePayload(payloadSegment: string, secret: string) {
  return createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

export function createGoogleOAuthState(secret: string, from: unknown) {
  const verifier = randomBytes(32).toString("base64url");
  const payload: GoogleOAuthState = {
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_MAX_AGE_SECONDS,
    from: sanitizeLocalRedirectTarget(from, "/account"),
    nonce: randomBytes(24).toString("base64url"),
    state: randomBytes(24).toString("base64url"),
    verifier,
    v: 1,
  };
  const payloadSegment = toBase64Url(JSON.stringify(payload));
  const signature = signStatePayload(payloadSegment, secret);
  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");

  return {
    codeChallenge,
    cookieValue: `${payloadSegment}.${signature}`,
    payload,
  };
}

export function verifyGoogleOAuthState(cookieValue: string | undefined, secret: string) {
  if (!cookieValue) return null;

  try {
    const [payloadSegment, signatureSegment, extra] = cookieValue.split(".");
    if (!payloadSegment || !signatureSegment || extra) return null;

    const expected = Buffer.from(signStatePayload(payloadSegment, secret));
    const actual = Buffer.from(signatureSegment);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as Partial<GoogleOAuthState>;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.v !== 1 ||
      typeof payload.exp !== "number" ||
      payload.exp <= now ||
      typeof payload.from !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.state !== "string" ||
      typeof payload.verifier !== "string"
    ) {
      return null;
    }

    return payload as GoogleOAuthState;
  } catch {
    return null;
  }
}

export function getGoogleAuthConfig(): GoogleAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, "");
  if (!clientId || !clientSecret || !appUrl) return null;

  return {
    appUrl,
    clientId,
    clientSecret,
    redirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
      `${appUrl}/api/auth/google/callback`,
  };
}

export function isGoogleAuthConfigured() {
  return Boolean(
    getGoogleAuthConfig() &&
    validateUserSessionSecret(process.env.USER_SESSION_SECRET).secret,
  );
}

export function buildGoogleAuthorizationUrl(config: GoogleAuthConfig, state: GoogleOAuthState, codeChallenge: string) {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state.state);
  url.searchParams.set("nonce", state.nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleAuthorizationCode(
  config: GoogleAuthConfig,
  code: string,
  verifier: string,
  expectedNonce: string,
): Promise<GoogleIdentityClaims> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GoogleSignInError("invalid-identity", "Google authorization could not be completed.");
  }

  const tokens = await response.json() as { id_token?: string };
  if (!tokens.id_token) {
    throw new GoogleSignInError("invalid-identity", "Google did not return an identity token.");
  }

  const ticket = await new OAuth2Client(config.clientId).verifyIdToken({
    idToken: tokens.id_token,
    audience: config.clientId,
  });
  const payload = ticket.getPayload();
  if (
    !payload?.sub ||
    !payload.email ||
    payload.email_verified !== true ||
    payload.nonce !== expectedNonce
  ) {
    throw new GoogleSignInError("invalid-identity", "Google returned an invalid or unverified identity.");
  }

  return {
    email: payload.email.trim().toLowerCase(),
    emailVerified: true,
    hostedDomain: payload.hd ?? null,
    name: payload.name?.trim() || null,
    nonce: payload.nonce,
    subject: payload.sub,
  };
}

export function isGoogleAuthoritativeForEmail(claims: Pick<GoogleIdentityClaims, "email" | "emailVerified" | "hostedDomain">) {
  return (
    claims.emailVerified &&
    (claims.email.toLowerCase().endsWith("@gmail.com") || Boolean(claims.hostedDomain))
  );
}

export function canLinkGoogleEmail(
  claims: Pick<GoogleIdentityClaims, "email" | "emailVerified" | "hostedDomain">,
  cardShowNationEmailVerified: boolean,
) {
  return isGoogleAuthoritativeForEmail(claims) || cardShowNationEmailVerified;
}

async function findUserByGoogleSubject(subject: string) {
  const rows = await db.$queryRaw<GoogleUserRow[]>(Prisma.sql`
    SELECT u.id, u.email, u.role, u."emailVerifiedAt"
    FROM "AuthIdentity" identity
    INNER JOIN "User" u ON u.id = identity."userId"
    WHERE identity.provider = ${GOOGLE_PROVIDER}
      AND identity."providerSubject" = ${subject}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function signInWithGoogleIdentity(claims: GoogleIdentityClaims) {
  if (!claims.subject || !claims.email || !claims.emailVerified) {
    throw new GoogleSignInError("invalid-identity", "Google returned an incomplete identity.");
  }

  const linkedUser = await findUserByGoogleSubject(claims.subject);
  if (linkedUser) {
    if (linkedUser.role !== "FAN") {
      throw new GoogleSignInError("account-conflict", "This Google identity is not linked to a member account.");
    }

    await db.$executeRaw(Prisma.sql`
      UPDATE "AuthIdentity"
      SET "providerEmail" = ${claims.email},
          "lastUsedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE provider = ${GOOGLE_PROVIDER}
        AND "providerSubject" = ${claims.subject}
    `);
    return linkedUser;
  }

  const result = await db.$transaction(async (tx) => {
    const existingRows = await tx.$queryRaw<GoogleUserRow[]>(Prisma.sql`
      SELECT id, email, role, "emailVerifiedAt"
      FROM "User"
      WHERE email = ${claims.email}
      LIMIT 1
    `);
    const existing = existingRows[0] ?? null;

    if (existing && existing.role !== "FAN") {
      throw new GoogleSignInError(
        "account-conflict",
        "That email belongs to a promoter, moderator, or admin account. Use its existing sign-in method.",
      );
    }

    if (!canLinkGoogleEmail(claims, Boolean(existing?.emailVerifiedAt))) {
      throw new GoogleSignInError(
        "email-not-authoritative",
        "Use email verification for this address before linking Google.",
      );
    }

    const userId = existing?.id ?? randomUUID();
    if (!existing) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "User" (
          id, name, email, "passwordHash", "sessionVersion", role,
          "emailVerifiedAt", "createdAt", "updatedAt"
        )
        VALUES (
          ${userId}, ${claims.name ?? null}, ${claims.email}, NULL, 1,
          'FAN'::"UserRole", NOW(), NOW(), NOW()
        )
      `);
    } else if (!existing.emailVerifiedAt) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "User"
        SET "emailVerifiedAt" = NOW(),
            name = COALESCE(name, ${claims.name ?? null}),
            "updatedAt" = NOW()
        WHERE id = ${userId}
      `);
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "EmailVerificationToken"
        WHERE "userId" = ${userId}
      `);
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "AuthIdentity" (
        id, "userId", provider, "providerSubject", "providerEmail",
        "createdAt", "updatedAt", "lastUsedAt"
      )
      VALUES (
        ${randomUUID()}, ${userId}, ${GOOGLE_PROVIDER}, ${claims.subject},
        ${claims.email}, NOW(), NOW(), NOW()
      )
    `);

    return {
      email: claims.email,
      emailVerifiedAt: existing?.emailVerifiedAt ?? new Date(),
      id: userId,
      role: "FAN" as const,
      created: !existing,
    };
  });

  try {
    await writeAuditLog({
      actorId: result.id,
      actorRole: "FAN",
      action: result.created ? "auth.google.account_created" : "auth.google.account_linked",
      targetType: "User",
      targetId: result.id,
      details: { email: result.email },
    });
  } catch (error) {
    console.error("[google-auth] audit log failed", { userId: result.id, error });
  }

  return result;
}
