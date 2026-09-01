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
import {
  getEmailConfigStatus,
  isSignupEmailVerificationRequired,
  sendFanVerificationEmail,
  sendPromoterVerificationEmail,
} from "@/lib/email";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, readPasswordInput } from "@/lib/passwords";
import {
  registerFanAccount,
  updateFanStateSubscriptions,
} from "@/lib/users";
import {
  PasswordField,
  PromoterOptInFields,
  StateMultiSelect,
} from "@/components/account/signup-form-controls";
import { GoogleSignInLink } from "@/components/auth/google-sign-in-link";
import { getPromoterSessionSecret } from "@/lib/promoter-auth";
import { registerPromoterAccount } from "@/lib/promoters";
import { db } from "@/lib/db";

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
  const verificationRequired = isSignupEmailVerificationRequired();
  const isPromoter = formData.get("isPromoter") === "on";
  const name = readRequiredString(formData, "name", 120);
  const organizerName = readRequiredString(formData, "organizerName", 160);
  const email = readRequiredString(formData, "email", 320).toLowerCase();
  const password = readPasswordInput(formData, "password");
  const confirmPassword = readPasswordInput(formData, "confirmPassword");
  const stateCodes = formData
    .getAll("stateCodes")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toUpperCase())
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

  if (
    !sessionSecret ||
    (isPromoter && !promoterSessionSecret) ||
    (verificationRequired && !getEmailConfigStatus().ready)
  ) {
    redirect("/account/signup?error=disabled");
  }

  if (
    !name ||
    !isValidEmail(email) ||
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
      : await registerFanAccount({ email, password, name, stateCodes, organizerIds: [] });
    if (isPromoter) {
      await updateFanStateSubscriptions(user.id, stateCodes);
    }

    if (!verificationRequired) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
      redirect(`/account/signup?ready=1&type=${isPromoter ? "promoter" : "member"}`);
    }

    const token = await createVerificationToken(user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com";
    const verifyUrl = `${appUrl}/${isPromoter ? "promoter" : "account"}/verify?token=${token}`;
    try {
      if (isPromoter) {
        await sendPromoterVerificationEmail(email, verifyUrl);
      } else {
        await sendFanVerificationEmail(email, verifyUrl);
      }
    } catch (error) {
      console.error("[account verification] initial send failed", {
        error,
        userId: user.id,
      });
      redirect(`/account/signup?error=email&type=${isPromoter ? "promoter" : "member"}`);
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
  searchParams: Promise<{
    error?: string;
    promoter?: string;
    ready?: string;
    sent?: string;
    type?: string;
  }>;
}) {
  const [session, secret, secretStatus, sp] = await Promise.all([
    getUserSession(),
    getUserSessionSecret(),
    getUserSessionSecretStatus(),
    searchParams,
  ]);
  const verificationRequired = isSignupEmailVerificationRequired();
  const emailStatus = getEmailConfigStatus();
  if (session) {
    redirect("/account");
  }

  if (sp.ready === "1") {
    const loginHref = sp.type === "promoter" ? "/promoter/login" : "/account/login";
    return (
      <div className="container-wide py-6 sm:py-10">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Account ready
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Your account has been created
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Email verification is temporarily turned off. You can sign in now.
          </p>
          <Link
            href={loginHref}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
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
            <Link
              href={`/account/resend-verification?audience=${sp.type === "promoter" ? "promoter" : "member"}`}
              className="font-semibold text-brand-700 hover:text-brand-800"
            >
              send a new verification link
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const errorMessage =
    sp.error === "disabled"
      ? verificationRequired && !emailStatus.ready
        ? emailStatus.error
        : secretStatus.error === "too_short"
        ? `USER_SESSION_SECRET must be at least ${MIN_USER_SESSION_SECRET_LENGTH} characters.`
        : "User accounts are disabled until USER_SESSION_SECRET is set on the server."
      : sp.error === "rate"
        ? "Too many attempts. Wait a bit and try again."
        : sp.error === "validation"
          ? `Check your information. Passwords must match and be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`
          : sp.error === "email"
            ? "Your account was created, but the verification email could not be delivered. Request a new link below."
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
        <p className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          Free during beta
        </p>

        {!secret && (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {secretStatus.error === "too_short"
              ? `USER_SESSION_SECRET must be at least ${MIN_USER_SESSION_SECRET_LENGTH} characters.`
              : "Set `USER_SESSION_SECRET` before creating member accounts."}
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {sp.error === "email" && (
          <Link
            href={`/account/resend-verification?audience=${sp.type === "promoter" ? "promoter" : "member"}`}
            className="mt-4 inline-flex font-semibold text-brand-700 hover:text-brand-800"
          >
            Send a new verification link
          </Link>
        )}

        <GoogleSignInLink />

        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          By continuing with Google or creating an account, you agree to the <Link href="/terms" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Terms of Use</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Privacy Policy</Link>.
        </p>

        <form action={handleSignup} className="mt-8 space-y-6">
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
              disabled={!secret}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
            <p className="mt-2 text-sm text-slate-500">
              {verificationRequired
                ? "We will send a verification link to this address before the account is activated."
                : "Email verification is temporarily turned off. You can sign in immediately after signup."}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PasswordField
              id="password"
              name="password"
              label="Password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              disabled={!secret}
            />
            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              disabled={!secret}
            />
          </div>

          <PromoterOptInFields
            defaultChecked={sp.promoter === "1"}
            disabled={!secret || (verificationRequired && !emailStatus.ready)}
          />

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">States to be notified about</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search, scroll, and select multiple states. You can change this later.
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Future: SMS / push</p>
            </div>

            <StateMultiSelect states={US_STATES} disabled={!secret} />
          </div>

          <p className="text-center text-sm text-slate-500">
            After signup, choose favorite show hosts from your account settings.
          </p>

          <button
            type="submit"
            disabled={!secret || (verificationRequired && !emailStatus.ready)}
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
