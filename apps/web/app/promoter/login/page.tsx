import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticatePromoter } from "@/lib/promoters";
import {
  getPromoterSession,
  getPromoterSessionSecret,
  getPromoterSessionSecretStatus,
  MIN_PROMOTER_SESSION_SECRET_LENGTH,
  startPromoterSession,
} from "@/lib/promoter-auth";
import { MAX_PASSWORD_LENGTH, readPasswordInput } from "@/lib/passwords";
import { getRequestIp } from "@/lib/request-ip";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { sanitizeLocalRedirectTarget } from "@/lib/url";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 30 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function sanitizePromoterRedirectTarget(value: unknown) {
  const sanitized = sanitizeLocalRedirectTarget(value, "/promoter");
  return sanitized.startsWith("/promoter/login") ? "/promoter" : sanitized;
}

function readString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleLogin(formData: FormData) {
  "use server";

  const email = readString(formData, "email", 320).toLowerCase();
  const password = readPasswordInput(formData, "password");
  const redirectTo = sanitizePromoterRedirectTarget(
    formData.get("next") ?? formData.get("from")
  );
  const sessionSecret = await getPromoterSessionSecret();
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit("promoter-login", ip, {
    blockMs: LOGIN_BLOCK_MS,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    redirect(`/promoter/login?error=rate&next=${encodeURIComponent(redirectTo)}`);
  }

  if (!sessionSecret) {
    redirect(`/promoter/login?error=disabled&next=${encodeURIComponent(redirectTo)}`);
  }

  const user = await authenticatePromoter(email, password);
  if (!user) {
    await delay(750);
    redirect(`/promoter/login?error=invalid&next=${encodeURIComponent(redirectTo)}`);
  }

  if (!user.emailVerifiedAt) {
    redirect(`/promoter/login?error=unverified&next=${encodeURIComponent(redirectTo)}`);
  }

  await resetRateLimit("promoter-login", ip);
  await startPromoterSession(user.id);
  redirect(redirectTo);
}

export default async function PromoterLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string; next?: string }>;
}) {
  const [session, secret, secretStatus, sp] = await Promise.all([
    getPromoterSession(),
    getPromoterSessionSecret(),
    getPromoterSessionSecretStatus(),
    searchParams,
  ]);
  if (session) {
    redirect("/promoter");
  }

  const next = sanitizePromoterRedirectTarget(sp.next ?? sp.from);
  const errorMessage =
    sp.error === "rate"
      ? "Too many attempts. Wait 30 minutes and try again."
      : sp.error === "invalid"
        ? "Email or password did not match this promoter account."
        : sp.error === "unverified"
          ? "Please verify your email before logging in. Check your inbox for the verification link."
          : null;
  const disabledMessage =
    secretStatus.error === "missing"
      ? "Set PROMOTER_SESSION_SECRET to enable promoter sign-in."
      : secretStatus.error === "too_short"
        ? `PROMOTER_SESSION_SECRET must be at least ${MIN_PROMOTER_SESSION_SECRET_LENGTH} characters.`
        : null;

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Login
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Log in
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Access your saved promoter profile and mobile show posting tools.
        </p>

        {!secret && disabledMessage && (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {disabledMessage}
          </p>
        )}

        {errorMessage && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <form action={handleLogin} className="mt-8 space-y-5">
          <input type="hidden" name="next" value={next} />

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
            Log in
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:justify-between">
          <p>
            Need an account?{" "}
            <Link href="/promoter/signup" className="font-semibold text-brand-700 hover:text-brand-800">
              Create promoter account
            </Link>
          </p>
          <p>
            <Link href="/promoter/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800">
              Forgot password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
