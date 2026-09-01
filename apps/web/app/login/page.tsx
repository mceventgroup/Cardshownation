import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getModeratorSession, getModeratorSessionSecret, startModeratorSession } from "@/lib/moderator-auth";
import { readPasswordInput, verifyPassword, MAX_PASSWORD_LENGTH } from "@/lib/passwords";
import { getPromoterSession, getPromoterSessionSecret, startPromoterSession } from "@/lib/promoter-auth";
import { getRequestIp } from "@/lib/request-ip";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getUserSession, getUserSessionSecret, startUserSession } from "@/lib/user-auth";
import { sanitizeLocalRedirectTarget } from "@/lib/url";
import { GoogleSignInLink } from "@/components/auth/google-sign-in-link";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 30 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Card Show Nation collector or promoter account.",
  robots: { index: false, follow: true },
};

function readString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function getDefaultDestination(role: "FAN" | "MODERATOR" | "ORGANIZER") {
  switch (role) {
    case "MODERATOR":
      return "/moderator";
    case "ORGANIZER":
      return "/promoter";
    default:
      return "/account";
  }
}

function resolveDestination(role: "FAN" | "MODERATOR" | "ORGANIZER", requested: unknown) {
  const fallback = getDefaultDestination(role);
  const sanitized = sanitizeLocalRedirectTarget(requested, fallback);
  const floorplannerDestination =
    sanitized === "/floorplanner" || sanitized.startsWith("/floorplanner/");

  if (floorplannerDestination) {
    return sanitized;
  }

  switch (role) {
    case "MODERATOR":
      return sanitized.startsWith("/moderator") ? sanitized : fallback;
    case "ORGANIZER":
      return sanitized.startsWith("/promoter") ? sanitized : fallback;
    default:
      return sanitized.startsWith("/account") ? sanitized : fallback;
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleLogin(formData: FormData) {
  "use server";

  const email = readString(formData, "email", 320).toLowerCase();
  const password = readPasswordInput(formData, "password");
  const requestedDestination = formData.get("from");
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit("public-login", ip, {
    blockMs: LOGIN_BLOCK_MS,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    redirect("/login?error=rate");
  }

  const user = await db.user.findUnique({
    where: { email },
    include: {
      organizer: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user || (user.role !== "FAN" && user.role !== "MODERATOR" && user.role !== "ORGANIZER")) {
    await delay(750);
    redirect("/login?error=invalid");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await delay(750);
    redirect("/login?error=invalid");
  }

  if (!user.emailVerifiedAt) {
    redirect(`/login?error=unverified&role=${user.role.toLowerCase()}`);
  }

  if (user.role === "MODERATOR") {
    const secret = await getModeratorSessionSecret();
    if (!secret) {
      redirect("/login?error=disabled&role=moderator");
    }

    await resetRateLimit("public-login", ip);
    await startModeratorSession(user.id);
    redirect(resolveDestination("MODERATOR", requestedDestination));
  }

  if (user.role === "ORGANIZER") {
    if (!user.organizer) {
      redirect("/login?error=invalid");
    }

    const [promoterSecret, userSecret] = await Promise.all([
      getPromoterSessionSecret(),
      getUserSessionSecret(),
    ]);
    if (!promoterSecret) {
      redirect("/login?error=disabled&role=promoter");
    }
    if (!userSecret) {
      redirect("/login?error=disabled&role=member");
    }

    await resetRateLimit("public-login", ip);
    await Promise.all([startPromoterSession(user.id), startUserSession(user.id)]);
    redirect(resolveDestination("ORGANIZER", requestedDestination));
  }

  const secret = await getUserSessionSecret();
  if (!secret) {
    redirect("/login?error=disabled&role=member");
  }

  await resetRateLimit("public-login", ip);
  await startUserSession(user.id);
  redirect(resolveDestination("FAN", requestedDestination));
}

export default async function UnifiedLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; role?: string; from?: string; reset?: string }>;
}) {
  const [memberSession, promoterSession, moderatorSession, sp] = await Promise.all([
    getUserSession(),
    getPromoterSession(),
    getModeratorSession(),
    searchParams,
  ]);

  if (moderatorSession) {
    redirect("/moderator");
  }

  if (promoterSession) {
    redirect("/promoter");
  }

  if (memberSession) {
    redirect("/account");
  }

  const errorMessage =
    sp.error === "rate"
      ? "Too many attempts. Wait 30 minutes and try again."
      : sp.error === "invalid"
        ? "Email or password did not match a member or promoter account."
        : sp.error === "unverified"
          ? "Please verify your email before logging in."
            : sp.error === "disabled"
            ? sp.role === "moderator"
              ? "Moderator sign-in is disabled until MODERATOR_SESSION_SECRET is configured."
              : sp.role === "promoter"
                ? "Promoter sign-in is disabled until PROMOTER_SESSION_SECRET is configured."
                : "Member sign-in is disabled until USER_SESSION_SECRET is configured."
            : sp.error === "google-account-conflict"
              ? "That Google email belongs to a promoter, moderator, or admin account. Use the existing email and password sign-in."
              : sp.error === "google-email-verification"
                ? "Google cannot confirm current ownership of that non-Gmail address. Create or verify the member account by email instead."
                : sp.error === "google-cancelled"
                  ? "Google sign-in was cancelled."
                  : sp.error?.startsWith("google-")
                    ? "Google sign-in could not be completed. Please try again."
            : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Account access
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Welcome back
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          One account gives you collector features, plus promoter tools if you organize shows.
        </p>

        {errorMessage && (
          <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {sp.reset === "1" && (
          <p className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Password updated. Sign in with your new password.
          </p>
        )}

        <GoogleSignInLink from={sp.from ?? "/account"} compact />

        <form action={handleLogin} className="space-y-4">
          <input type="hidden" name="from" value={sp.from ?? ""} />

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
              <Link href="/account/forgot-password" className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              maxLength={MAX_PASSWORD_LENGTH}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Sign in
          </button>
        </form>

        {sp.error === "unverified" && (
          <p className="mt-4 text-sm text-slate-600">
            Need another email?{" "}
            <Link href="/account/resend-verification" className="font-semibold text-brand-700 hover:text-brand-800">
              Send a new verification link
            </Link>
          </p>
        )}

        <div className="mt-6 border-t border-slate-200 pt-5 text-sm">
          <p className="text-slate-600">New to Card Show Nation?</p>
          <Link href="/account/signup" className="mt-2 inline-flex font-semibold text-brand-700 hover:text-brand-800">
            Create an account
          </Link>
        </div>

        <aside className="mt-5 rounded-2xl bg-brand-50 p-4">
          <p className="font-semibold text-slate-950">Know about an upcoming card show?</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">Help collectors find it. Listings are free and you don&apos;t need an account.</p>
          <Link href="/submit-show" className="mt-3 inline-flex rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Submit a show free</Link>
        </aside>
      </div>
    </div>
  );
}
