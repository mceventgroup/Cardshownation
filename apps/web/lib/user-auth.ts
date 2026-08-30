import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { validateSessionSecret } from "@/lib/session-secret";
import {
  createUserSessionToken,
  USER_COOKIE_NAME,
  USER_SESSION_MAX_AGE_SECONDS,
  verifyUserSessionToken,
} from "@/lib/user-session";
import { sanitizeLocalRedirectTarget } from "@/lib/url";

export const MIN_USER_SESSION_SECRET_LENGTH = 32;

export function validateUserSessionSecret(secret: string | null | undefined) {
  return validateSessionSecret(secret, MIN_USER_SESSION_SECRET_LENGTH);
}

export async function getUserSessionSecret() {
  return validateUserSessionSecret(process.env.USER_SESSION_SECRET).secret;
}

export async function getUserSessionSecretStatus() {
  return validateUserSessionSecret(process.env.USER_SESSION_SECRET);
}

export async function getUserSession() {
  const secret = await getUserSessionSecret();
  if (!secret) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const payload = await verifyUserSessionToken(token, secret);
  if (!payload) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: payload.uid },
    include: {
      subscriptions: {
        orderBy: { stateCode: "asc" },
      },
    },
  });

  if (
    !user ||
    (user.role !== "FAN" && user.role !== "ORGANIZER") ||
    !user.emailVerifiedAt ||
    payload.sv !== user.sessionVersion
  ) {
    return null;
  }

  return { user };
}

export async function requireUserSession(from = "/account") {
  const session = await getUserSession();
  if (session) {
    return session;
  }

  redirect(`/account/login?from=${encodeURIComponent(sanitizeLocalRedirectTarget(from, "/account"))}`);
}

export async function startUserSession(userId: string) {
  const secret = await getUserSessionSecret();
  if (!secret) {
    throw new Error("User accounts are not configured.");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      sessionVersion: true,
    },
  });
  if (!user || (user.role !== "FAN" && user.role !== "ORGANIZER")) {
    throw new Error("Member account not found.");
  }

  const token = await createUserSessionToken(userId, user.sessionVersion, secret);
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  });
}

export async function endUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(USER_COOKIE_NAME);
}
