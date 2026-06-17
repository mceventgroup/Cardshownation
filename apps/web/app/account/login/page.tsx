import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateFan } from "@/lib/users";
import { MAX_PASSWORD_LENGTH, readPasswordInput } from "@/lib/passwords";
import { getRequestIp } from "@/lib/request-ip";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import {
  getUserSession,
  getUserSessionSecret,
  getUserSessionSecretStatus,
  MIN_USER_SESSION_SECRET_LENGTH,
  startUserSession,
} from "@/lib/user-auth";
import { sanitizeLocalRedirectTarget } from "@/lib/url";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 30 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function sanitizeUserRedirectTarget(value: unknown) {
  const sanitized = sanitizeLocalRedirectTarget(value, "/account");
  return sanitized.startsWith("/account/login") ? "/account" : sanitized;
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
  const redirectTo = sanitizeUserRedirectTarget(formData.get("from"));
  const sessionSecret = await getUserSessionSecret();
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit("user-login", ip, {
    blockMs: LOGIN_BLOCK_MS,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    redirect(`/account/login?error=rate&from=${encodeURIComponent(redirectTo)}`);
  }

  if (!sessionSecret) {
    redirect(`/account/login?error=disabled&from=${encodeURIComponent(redirectTo)}`);
  }

  const user = await authenticateFan(email, password);
  if (!user) {
    await delay(750);
    redirect(`/account/login?error=invalid&from=${encodeURIComponent(redirectTo)}`);
  }

  if (!user.emailVerifiedAt) {
    redirect(`/account/login?error=unverified&from=${encodeURIComponent(redirectTo)}`);
  }

  await resetRateLimit("user-login", ip);
  await startUserSession(user.id);
  redirect(redirectTo);
}

export default async function UserLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const [session, secret, secretStatus, sp] = await Promise.all([
    getUserSession(),
    getUserSessionSecret(),
    getUserSessionSecretStatus(),
    searchParams,
  ]);
  if (session) {
    redirect("/account");
  }

  const from = sanitizeUserRedirectTarget(sp.from);
  const errorMessage =
    sp.error === "disabled"
      ? secretStatus.error === "too_short"
        ? `USER_SESSION_SECRET must be at least ${MIN_USER_SESSION_SECRET_LENGTH} characters.`
        : "User accounts are disabled until USER_SESSION_SECRET is set on the server."
      : sp.error === "rate"
        ? "Too many attempts. Wait 30 minutes and try again."
        : sp.error === "invalid"
          ? "Email or password did not match this account."
          : sp.error === "unverified"
            ? "Please verify your email before logging in. Check your inbox for the verification link."
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
          Manage your saved states for upcoming show email alerts.
        </p>

        {!secret && (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {secretStatus.error === "too_short"
              ? `USER_SESSION_SECRET must be at least ${MIN_USER_SESSION_SECRET_LENGTH} characters.`
              : "Set `USER_SESSION_SECRET` to enable member sign-in."}
          </p>
        )}

        {errorMessage && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <form action={handleLogin} className="mt-8 space-y-5">
          <input type="hidden" name="from" value={from} />

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
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

        <p className="mt-6 text-sm text-slate-600">
          <Link href="/account/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800">
            Forgot password?
          </Link>
        </p>

        <p className="mt-3 text-sm text-slate-600">
          Need an account?{" "}
          <Link href="/account/signup" className="font-semibold text-brand-700 hover:text-brand-800">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
