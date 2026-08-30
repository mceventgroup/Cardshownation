import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { US_STATES } from "@/lib/states";
import { getRequestIp } from "@/lib/request-ip";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hashOpaqueToken } from "@/lib/token-hash";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import {
  getUserSession,
  getUserSessionSecret,
  getUserSessionSecretStatus,
  MIN_USER_SESSION_SECRET_LENGTH,
} from "@/lib/user-auth";
import { createVerificationToken } from "@/lib/verification-token";
import { sendFanVerificationEmail, sendPromoterVerificationEmail } from "@/lib/email";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, readPasswordInput } from "@/lib/passwords";
import {
  listFavoriteOrganizerOptions,
  registerFanAccount,
  updateFanFavoriteOrganizers,
  updateFanStateSubscriptions,
} from "@/lib/users";
import { GoogleSignInLink } from "@/components/auth/google-sign-in-link";
import { getPromoterSessionSecret } from "@/lib/promoter-auth";
import { registerPromoterAccount } from "@/lib/promoters";

const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const SIGNUP_BLOCK_MS = 2 * 60 * 60 * 1000;
const MAX_SIGNUP_ATTEMPTS = 5;

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

function readOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) || null : null;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleSignup(formData: FormData) {
  "use server";

  const sessionSecret = await getUserSessionSecret();
  const promoterSessionSecret = await getPromoterSessionSecret();
  const isPromoter = formData.get("isPromoter") === "on";
  const name = readRequiredString(formData, "name", 120);
  const organizerName = readRequiredString(formData, "organizerName", 160);
  const email = readRequiredString(formData, "email", 320).toLowerCase();
  const confirmEmail = readRequiredString(formData, "confirmEmail", 320).toLowerCase();
  const password = readPasswordInput(formData, "password");
  const confirmPassword = readPasswordInput(formData, "confirmPassword");
  const stateCodes = formData
    .getAll("stateCodes")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const organizerIds = formData
    .getAll("organizerIds")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit("user-signup", ip, {
    blockMs: SIGNUP_BLOCK_MS,
    maxAttempts: MAX_SIGNUP_ATTEMPTS,
    windowMs: SIGNUP_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    redirect("/account/signup?error=rate");
  }
  const emailRateLimit = await consumeRateLimit("user-signup-email", hashOpaqueToken(email), {
    blockMs: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!emailRateLimit.allowed) redirect("/account/signup?error=rate");

  if (!sessionSecret || (isPromoter && !promoterSessionSecret)) {
    redirect("/account/signup?error=disabled");
  }

  if (
    !name ||
    !isValidEmail(email) ||
    email !== confirmEmail ||
    password.length < MIN_PASSWORD_LENGTH ||
    password !== confirmPassword ||
    (isPromoter && !organizerName)
  ) {
    redirect("/account/signup?error=validation");
  }

  try {
    const user = isPromoter
      ? await registerPromoterAccount({
          contactName: name,
          organizerName,
          email,
          password,
          websiteUrl: readOptionalString(formData, "websiteUrl", 2048),
          facebookUrl: readOptionalString(formData, "facebookUrl", 2048),
          instagramUrl: readOptionalString(formData, "instagramUrl", 2048),
        })
      : await registerFanAccount({ email, password, name, stateCodes, organizerIds });
    if (isPromoter) {
      await Promise.all([
        updateFanStateSubscriptions(user.id, stateCodes),
        updateFanFavoriteOrganizers(user.id, organizerIds),
      ]);
    }
    const token = await createVerificationToken(user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com";
    const verifyUrl = `${appUrl}/${isPromoter ? "promoter" : "account"}/verify?token=${token}`;
    if (isPromoter) {
      await sendPromoterVerificationEmail(email, verifyUrl);
    } else {
      await sendFanVerificationEmail(email, verifyUrl);
    }
    redirect(`/account/signup?sent=1&type=${isPromoter ? "promoter" : "member"}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    await delay(750);
    redirect("/account/signup?error=try-again");
  }
}

export default async function UserSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; promoter?: string; type?: string }>;
}) {
  const [session, secret, secretStatus, sp] = await Promise.all([
    getUserSession(),
    getUserSessionSecret(),
    getUserSessionSecretStatus(),
    searchParams,
  ]);
  const favoriteOrganizers = await listFavoriteOrganizerOptions();
  if (session) {
    redirect("/account");
  }

  if (sp.sent === "1") {
    return (
      <div className="container-wide py-6 sm:py-10">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Check your inbox
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Verify your email
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            We sent a verification link to your email address. Click the link to activate your
            account. The link expires in 24 hours.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Didn&apos;t get it? Check your spam folder or{" "}
            <Link href="/account/signup" className="font-semibold text-brand-700 hover:text-brand-800">
              try again
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const errorMessage =
    sp.error === "disabled"
        ? secretStatus.error === "too_short"
          ? `USER_SESSION_SECRET must be at least ${MIN_USER_SESSION_SECRET_LENGTH} characters.`
          : "User accounts are disabled until USER_SESSION_SECRET is set on the server."
        : sp.error === "rate"
          ? "Too many attempts. Wait a bit and try again."
          : sp.error === "validation"
            ? `Check your information. Email addresses and passwords must match; passwords must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`
            : sp.error === "try-again"
              ? "We couldn't create that account right now. Double-check your information or try signing in / resetting your password if you may already have an account."
            : null;

  return (
    <div className="container-wide py-6 sm:py-10">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          One Card Show Nation account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Create account
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Every account includes collector features. If you organize shows, add promoter tools to the same account below.
        </p>

        {!secret && (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {secretStatus.error === "too_short"
              ? `USER_SESSION_SECRET must be at least ${MIN_USER_SESSION_SECRET_LENGTH} characters.`
              : "Set `USER_SESSION_SECRET` before creating member accounts."}
          </p>
        )}

        {errorMessage && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <GoogleSignInLink />

        <form action={handleSignup} className="mt-8 space-y-6">
          <label className="flex items-start gap-3 rounded-3xl border border-brand-200 bg-brand-50 p-5 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isPromoter"
              defaultChecked={sp.promoter === "1"}
              disabled={!secret}
              className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block font-semibold text-slate-950">I organize card shows</span>
              <span className="mt-1 block leading-6">Add promoter tools to this account. You will still have all collector features.</span>
            </span>
          </label>

          <details open={sp.promoter === "1"} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <summary className="cursor-pointer font-semibold text-slate-900">Promoter profile details</summary>
            <p className="mt-2 text-sm text-slate-600">Complete this section when selecting “I organize card shows.”</p>
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="organizerName" className="mb-2 block text-sm font-medium text-slate-700">Organizer or business name</label>
                <input id="organizerName" name="organizerName" type="text" disabled={!secret} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none" />
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <input aria-label="Website" name="websiteUrl" type="url" placeholder="Website" disabled={!secret} className="rounded-2xl border border-slate-200 px-4 py-3 text-base" />
                <input aria-label="Facebook" name="facebookUrl" type="url" placeholder="Facebook" disabled={!secret} className="rounded-2xl border border-slate-200 px-4 py-3 text-base" />
                <input aria-label="Instagram" name="instagramUrl" type="url" placeholder="Instagram" disabled={!secret} className="rounded-2xl border border-slate-200 px-4 py-3 text-base" />
              </div>
            </div>
          </details>
          <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                disabled={!secret}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
              />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={!secret}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="confirmEmail" className="mb-2 block text-sm font-medium text-slate-700">
                Confirm email
              </label>
              <input
                id="confirmEmail"
                name="confirmEmail"
                type="email"
                required
                autoComplete="email"
                disabled={!secret}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                disabled={!secret}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                disabled={!secret}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Email alert states</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose any states you want to follow. You can change this later.
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Future: SMS / push</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {US_STATES.map((state) => (
                <label
                  key={state.code}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="stateCodes"
                    value={state.code}
                    disabled={!secret}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{state.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Favorite show hosts</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Follow the promoters you want to hear from first.
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Host alerts</p>
            </div>

            {favoriteOrganizers.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Promoter favorites will show up here as more hosts are linked to upcoming shows.
              </p>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {favoriteOrganizers.map((organizer) => (
                  <label
                    key={organizer.id}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      name="organizerIds"
                      value={organizer.id}
                      disabled={!secret}
                      className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{organizer.name}</span>
                      <span className="block text-xs text-slate-500">
                        {organizer.verified ? "Verified promoter" : "Promoter profile"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!secret}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Create account
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/account/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
