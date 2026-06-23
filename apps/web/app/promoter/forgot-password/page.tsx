import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/password-reset-token";
import { getEmailConfigStatus, sendPromoterPasswordResetEmail } from "@/lib/email";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import { getRequestIp } from "@/lib/request-ip";
import { consumeRateLimit } from "@/lib/rate-limit";

const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_BLOCK_MS = 60 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

async function handleForgotPassword(formData: FormData) {
  "use server";

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit("promoter-forgot-password", ip, {
    blockMs: RESET_BLOCK_MS,
    maxAttempts: MAX_RESET_ATTEMPTS,
    windowMs: RESET_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    redirect("/promoter/forgot-password?error=rate");
  }

  if (!email) {
    redirect("/promoter/forgot-password?error=1");
  }

  // Always redirect to the same page — don't leak whether the email exists
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        organizer: {
          select: {
            id: true,
          },
        },
      },
    });

    if (user?.organizer && user.role === "ORGANIZER") {
      const token = await createPasswordResetToken(user.id);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com";
      const resetUrl = `${appUrl}/promoter/reset-password?token=${token}`;
      await sendPromoterPasswordResetEmail(email, resetUrl);
    }
  } catch (error) {
    rethrowIfRedirectError(error);
    console.error("[promoter forgot-password] reset email failed", { error });
    redirect("/promoter/forgot-password?error=send");
  }

  redirect("/promoter/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const [sp, emailStatus] = await Promise.all([searchParams, Promise.resolve(getEmailConfigStatus())]);

  if (sp.sent === "1") {
    return (
      <div className="container-narrow py-6 sm:py-10">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Check your inbox
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Reset link sent
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            If that email is linked to a promoter account, you&apos;ll receive a
            password reset link shortly. The link expires in 1 hour.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Didn&apos;t get it? Check your spam folder or{" "}
            <Link
              href="/promoter/forgot-password"
              className="font-semibold text-brand-700 hover:text-brand-800"
            >
              try again
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const errorMessage =
    sp.error === "rate"
      ? "Too many reset requests from this connection. Please wait a bit and try again."
      :
    sp.error === "send"
      ? "We couldn't send the reset email right now. Please try again in a minute."
      : null;

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Promoter portal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Forgot password
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Enter the email address on your promoter account and we&apos;ll send
          you a reset link.
        </p>

        {!emailStatus.ready && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {emailStatus.error}
          </p>
        )}

        {errorMessage && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <form action={handleForgotPassword} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              disabled={!emailStatus.ready}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!emailStatus.ready}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Send reset link
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Remember your password?{" "}
          <Link href="/promoter/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
