import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import { createPasswordResetToken } from "@/lib/password-reset-token";

async function handleForgotPassword(formData: FormData) {
  "use server";

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) {
    redirect("/moderator/forgot-password?error=1");
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
    });

    if (user?.role === "MODERATOR") {
      const token = await createPasswordResetToken(user.id);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com";
      const resetUrl = `${appUrl}/moderator/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, resetUrl, "MODERATOR");
    }
  } catch (error) {
    rethrowIfRedirectError(error);
    console.error("[moderator forgot-password] reset email failed", { email, error });
    redirect("/moderator/forgot-password?error=send");
  }

  redirect("/moderator/forgot-password?sent=1");
}

export default async function ModeratorForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;

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
            If that email is linked to a moderator account, you&apos;ll receive a password
            reset link shortly. The link expires in 1 hour.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Didn&apos;t get it? Check your spam folder or{" "}
            <Link href="/moderator/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800">
              try again
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const errorMessage =
    sp.error === "send"
      ? "We couldn't send the reset email right now. Please try again in a minute."
      : null;

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Moderator portal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Forgot password
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Enter the email address on your moderator account and we&apos;ll send you a reset
          link.
        </p>

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
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Send reset link
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Remember your password?{" "}
          <Link href="/moderator/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
