import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateAdmin, hasAnyAdminUsers } from "@/lib/admins";
import {
  getAdminSession,
  getAdminSessionSecret,
  getAdminSessionSecretStatus,
  MIN_ADMIN_SESSION_SECRET_LENGTH,
  startAdminSession,
} from "@/lib/admin-auth";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
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

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleLogin(formData: FormData) {
  "use server";

  const email = readString(formData, "email", 320).toLowerCase();
  const password = readString(formData, "password", 200);
  const from = sanitizeLocalRedirectTarget(formData.get("from"));
  const sessionSecret = await getAdminSessionSecret();
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit("admin-login", ip, {
    blockMs: LOGIN_BLOCK_MS,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    redirect(`/admin/login?error=rate&from=${encodeURIComponent(from)}`);
  }

  if (!sessionSecret) {
    redirect(`/admin/login?error=disabled&from=${encodeURIComponent(from)}`);
  }

  const user = await authenticateAdmin(email, password);
  if (!user) {
    await delay(750);
    redirect(`/admin/login?error=1&from=${encodeURIComponent(from)}`);
  }

  await resetRateLimit("admin-login", ip);
  await startAdminSession(user.id);
  redirect(from);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const [session, adminExists, secretStatus, sp] = await Promise.all([
    getAdminSession(),
    hasAnyAdminUsers(),
    getAdminSessionSecretStatus(),
    searchParams,
  ]);

  if (session) {
    redirect("/admin");
  }

  if (!adminExists) {
    redirect("/admin/setup");
  }

  const from = sanitizeLocalRedirectTarget(sp.from);
  const errorMessage =
    sp.error === "disabled"
      ? secretStatus.error === "too_short"
        ? `ADMIN_SESSION_SECRET must be at least ${MIN_ADMIN_SESSION_SECRET_LENGTH} characters.`
        : "Admin login is disabled until ADMIN_SESSION_SECRET is configured."
      : sp.error === "rate"
      ? "Too many attempts. Wait 30 minutes and try again."
      : sp.error === "1"
        ? "Email or password was incorrect."
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">Admin login</h1>
        <p className="mt-1 text-sm text-slate-500">Card Show Nation</p>

        {secretStatus.error && (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {secretStatus.error === "too_short"
              ? `ADMIN_SESSION_SECRET must be at least ${MIN_ADMIN_SESSION_SECRET_LENGTH} characters.`
              : "Set `ADMIN_SESSION_SECRET` to enable admin sign-in."}
          </p>
        )}

        <form action={handleLogin} className="mt-6 space-y-4">
          <input type="hidden" name="from" value={from} />
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>
          {errorMessage && <p role="alert" className="text-sm text-red-600">{errorMessage}</p>}
          <button
            type="submit"
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Need the first admin account?{" "}
          <Link href="/admin/setup" className="font-semibold text-brand-700 hover:text-brand-800">
            Open setup
          </Link>
        </p>
      </div>
    </div>
  );
}

