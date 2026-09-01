import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAdminSession,
  getAdminSessionSecret,
  getAdminSessionSecretStatus,
  MIN_ADMIN_SESSION_SECRET_LENGTH,
  startAdminSession,
} from "@/lib/admin-auth";
import { hasAnyAdminUsers, MIN_ADMIN_PASSWORD_LENGTH, registerInitialAdmin } from "@/lib/admins";
import { getRequestIp } from "@/lib/request-ip";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";

const SETUP_WINDOW_MS = 60 * 60 * 1000;
const SETUP_BLOCK_MS = 2 * 60 * 60 * 1000;
const MAX_SETUP_ATTEMPTS = 5;

function readRequiredString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    return "";
  }

  return trimmed;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleSetup(formData: FormData) {
  "use server";

  const bootstrapCode = process.env.ADMIN_SETUP_CODE?.trim() || "";
  const sessionSecret = await getAdminSessionSecret();
  const name = readRequiredString(formData, "name", 120);
  const email = readRequiredString(formData, "email", 320).toLowerCase();
  const password = readRequiredString(formData, "password", 200);
  const confirmPassword = readRequiredString(formData, "confirmPassword", 200);
  const setupCode = readRequiredString(formData, "setupCode", 200);
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit("admin-setup", ip, {
    blockMs: SETUP_BLOCK_MS,
    maxAttempts: MAX_SETUP_ATTEMPTS,
    windowMs: SETUP_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    redirect("/admin/setup?error=rate");
  }

  if (!sessionSecret) {
    redirect("/admin/setup?error=secret");
  }

  if (!bootstrapCode) {
    redirect("/admin/setup?error=bootstrap");
  }
  if (!name) {
    redirect("/admin/setup?error=name");
  }
  if (!email || !isValidEmail(email)) {
    redirect("/admin/setup?error=email");
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    redirect("/admin/setup?error=password");
  }
  if (password !== confirmPassword) {
    redirect("/admin/setup?error=confirm");
  }
  if (setupCode !== bootstrapCode) {
    await delay(750);
    redirect("/admin/setup?error=setupcode");
  }

  try {
    const user = await registerInitialAdmin({ name, email, password });
    await resetRateLimit("admin-setup", ip);
    await startAdminSession(user.id);
    redirect("/admin");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect("/admin/setup?error=exists");
  }
}

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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

  if (adminExists) {
    redirect("/admin/login");
  }

  const bootstrapCodeExists = Boolean(process.env.ADMIN_SETUP_CODE?.trim());
  const adminSecretReady = secretStatus.error === null;
  const errorMessage =
    sp.error === "exists"
      ? "An admin account already exists."
      : sp.error === "rate"
        ? "Too many attempts. Wait a bit and try again."
      : sp.error === "bootstrap"
        ? "No setup code is configured on the server."
        : sp.error === "secret"
          ? secretStatus.error === "too_short"
            ? `ADMIN_SESSION_SECRET must be at least ${MIN_ADMIN_SESSION_SECRET_LENGTH} characters.`
            : "Set ADMIN_SESSION_SECRET before creating the first admin account."
        : sp.error === "name"
          ? "Enter a name."
          : sp.error === "email"
            ? "Enter a valid email address."
            : sp.error === "password"
              ? `Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`
              : sp.error === "confirm"
                ? "Password and confirmation do not match."
                : sp.error === "setupcode"
                  ? "Setup code did not match the server value."
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">Create first admin</h1>
        <p className="mt-1 text-sm text-slate-500">Card Show Nation admin bootstrap</p>

        {!bootstrapCodeExists ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Set `ADMIN_SETUP_CODE` so the first admin account can be created.
          </div>
        ) : !adminSecretReady ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {secretStatus.error === "too_short"
              ? `ADMIN_SESSION_SECRET must be at least ${MIN_ADMIN_SESSION_SECRET_LENGTH} characters.`
              : "Set `ADMIN_SESSION_SECRET` before creating the first admin account."}
          </div>
        ) : (
          <form action={handleSetup} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={MIN_ADMIN_PASSWORD_LENGTH}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={MIN_ADMIN_PASSWORD_LENGTH}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="setupCode" className="mb-1.5 block text-sm font-medium text-slate-700">
                Setup code
              </label>
              <input
                id="setupCode"
                name="setupCode"
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
              Create admin account
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-slate-600">
          Already set up?{" "}
          <Link href="/admin/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Go to login
          </Link>
        </p>
      </div>
    </div>
  );
}
