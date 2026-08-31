import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getEmailConfigStatus, sendFanVerificationEmail, sendPromoterVerificationEmail } from "@/lib/email";
import { createVerificationToken } from "@/lib/verification-token";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { hashOpaqueToken } from "@/lib/token-hash";

async function resendVerification(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 320);
  const audience = formData.get("audience") === "promoter" ? "promoter" : "member";
  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const ipLimit = await consumeRateLimit("user-resend-verification", ip, {
    blockMs: 60 * 60 * 1000,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed) redirect(`/account/resend-verification?audience=${audience}&error=rate`);

  if (email) {
    const emailLimit = await consumeRateLimit(
      "user-resend-verification-email",
      hashOpaqueToken(email),
      {
        blockMs: 6 * 60 * 60 * 1000,
        maxAttempts: 3,
        windowMs: 6 * 60 * 60 * 1000,
      },
    );
    if (!emailLimit.allowed) redirect(`/account/resend-verification?audience=${audience}&sent=1`);
  }

  try {
    const user = email
      ? await db.user.findUnique({ where: { email } })
      : null;
    const expectedRole = audience === "promoter" ? "ORGANIZER" : "FAN";
    if (user?.role === expectedRole && !user.emailVerifiedAt) {
      const token = await createVerificationToken(user.id);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com";
      const verifyUrl = `${appUrl}/${audience === "promoter" ? "promoter" : "account"}/verify?token=${token}`;
      if (audience === "promoter") await sendPromoterVerificationEmail(email, verifyUrl);
      else await sendFanVerificationEmail(email, verifyUrl);
    }
  } catch (error) {
    console.error("[account verification] resend failed", { error });
  }

  redirect(`/account/resend-verification?audience=${audience}&sent=1`);
}

export default async function ResendVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string; error?: string; sent?: string }>;
}) {
  const sp = await searchParams;
  const audience = sp.audience === "promoter" ? "promoter" : "member";
  const emailStatus = getEmailConfigStatus();

  if (sp.sent === "1") {
    return (
      <div className="container-narrow py-6 sm:py-10">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Check your inbox</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Verification link requested</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            If that email belongs to an unverified {audience} account, a new link is on the way.
          </p>
          <Link href="/login" className="mt-6 inline-flex font-semibold text-brand-700 hover:text-brand-800">
            Return to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">{audience === "promoter" ? "Promoter verification" : "Member verification"}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Send a new verification link</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Enter the exact email address used when the {audience} account was created.
        </p>
        {sp.error === "rate" && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Too many requests. Please wait before trying again.
          </p>
        )}
        {!emailStatus.ready && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {emailStatus.error}
          </p>
        )}
        <form action={resendVerification} className="mt-8 space-y-5">
          <input type="hidden" name="audience" value={audience} />
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={!emailStatus.ready}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!emailStatus.ready}
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send verification link
          </button>
        </form>
      </div>
    </div>
  );
}
