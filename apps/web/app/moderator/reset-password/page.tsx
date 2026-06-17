import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { consumePasswordResetToken } from "@/lib/password-reset-token";
import { getModeratorSessionSecret } from "@/lib/moderator-auth";
import { hashPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, readPasswordInput } from "@/lib/passwords";
import { startModeratorSession } from "@/lib/moderator-auth";

async function handleReset(token: string, formData: FormData) {
  "use server";

  const password = readPasswordInput(formData, "password");
  const confirmPassword = readPasswordInput(formData, "confirmPassword");

  if (!password || password.length < MIN_PASSWORD_LENGTH || password !== confirmPassword) {
    redirect(`/moderator/reset-password?token=${token}&error=validation`);
  }

  const user = await consumePasswordResetToken(token);
  if (!user || user.role !== "MODERATOR") {
    redirect("/moderator/reset-password?error=expired");
  }

  const sessionSecret = await getModeratorSessionSecret();
  if (!sessionSecret) {
    redirect("/moderator/reset-password?error=disabled");
  }

  const passwordHash = await hashPassword(password);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });

  await startModeratorSession(user.id);
  redirect("/moderator");
}

export default async function ModeratorResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim();

  if (sp.error === "expired" || !token) {
    return (
      <div className="container-narrow py-6 sm:py-10">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
            Link expired
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Reset link not valid
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            This password reset link is invalid or has expired. Reset links are valid for 1
            hour.
          </p>
          <Link
            href="/moderator/forgot-password"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  const errorMessage =
    sp.error === "validation"
      ? `Passwords must match and be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`
      : sp.error === "disabled"
        ? "Moderator sign-in is disabled until MODERATOR_SESSION_SECRET is configured."
        : null;

  const handleResetWithToken = handleReset.bind(null, token);

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Moderator portal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Reset password
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Enter a new password for your moderator account.
        </p>

        {errorMessage && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <form action={handleResetWithToken} className="mt-8 space-y-5">
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              autoComplete="new-password"
              autoFocus
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Set new password
          </button>
        </form>
      </div>
    </div>
  );
}
