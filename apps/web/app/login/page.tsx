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

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 30 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

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

    const secret = await getPromoterSessionSecret();
    if (!secret) {
      redirect("/login?error=disabled&role=promoter");
    }

    await resetRateLimit("public-login", ip);
    await startPromoterSession(user.id);
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
  searchParams: Promise<{ error?: string; role?: string; from?: string }>;
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
        ? "Email or password did not match a member, promoter, or moderator account."
        : sp.error === "unverified"
          ? "Please verify your email before logging in."
          : sp.error === "disabled"
            ? sp.role === "moderator"
              ? "Moderator sign-in is disabled until MODERATOR_SESSION_SECRET is configured."
              : sp.role === "promoter"
                ? "Promoter sign-in is disabled until PROMOTER_SESSION_SECRET is configured."
                : "Member sign-in is disabled until USER_SESSION_SECRET is configured."
            : null;

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Login
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Sign in to your account
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Use the same login form for member, promoter, and moderator accounts. We&apos;ll route you
          to the right dashboard after sign-in.
        </p>

        {errorMessage && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <form action={handleLogin} className="mt-8 space-y-5">
          <input type="hidden" name="from" value={sp.from ?? ""} />

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              maxLength={MAX_PASSWORD_LENGTH}
              autoComplete="current-password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <p>
            Member password reset:{" "}
            <Link href="/account/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800">
              Reset member password
            </Link>
          </p>
          <p>
            Promoter password reset:{" "}
            <Link href="/promoter/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800">
              Reset promoter password
            </Link>
          </p>
          <p>
            Moderator password reset:{" "}
            <Link href="/moderator/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800">
              Reset moderator password
            </Link>
          </p>
          <p>
            Need a member account?{" "}
            <Link href="/account/signup" className="font-semibold text-brand-700 hover:text-brand-800">
              Create account
            </Link>
          </p>
          <p>
            Need a promoter account?{" "}
            <Link href="/promoter/signup" className="font-semibold text-brand-700 hover:text-brand-800">
              Create promoter account
            </Link>
          </p>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Moderator accounts are created by admin. Admin sign-in stays on{" "}
          <Link href="/admin/login" className="font-semibold text-brand-700 hover:text-brand-800">
            the admin login page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
