import Link from "next/link";
import { redirect } from "next/navigation";
import { consumeVerificationToken } from "@/lib/verification-token";
import { startUserSession } from "@/lib/user-auth";

async function completeAccountVerification(token: string) {
  "use server";

  const user = await consumeVerificationToken(token, ["FAN", "ORGANIZER"]);
  if (!user) redirect("/account/verify?error=invalid");

  await startUserSession(user.id);
  redirect("/account");
}

export default async function AccountVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim();

  if (sp.error === "invalid") {
    return (
      <VerifyError message="This verification link is invalid or has expired. Request a new link below." />
    );
  }

  if (!token) {
    return <VerifyError message="No verification token provided." />;
  }

  const verifyAction = completeAccountVerification.bind(null, token);
  return <VerifyPrompt action={verifyAction} audience="member" />;
}

function VerifyPrompt({
  action,
  audience,
}: {
  action: () => Promise<void>;
  audience: string;
}) {
  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Email verification
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Confirm your email
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Select the button below to activate your Card Show Nation {audience} account.
        </p>
        <form action={action} className="mt-6">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:w-auto"
          >
            Verify email
          </button>
        </form>
      </div>
    </div>
  );
}

function VerifyError({ message }: { message: string }) {
  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
          Verification failed
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Link not valid
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{message}</p>
        <Link
          href="/account/resend-verification"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Send a new verification link
        </Link>
      </div>
    </div>
  );
}
