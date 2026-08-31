import Link from "next/link";
import { redirect } from "next/navigation";
import { consumeVerificationToken } from "@/lib/verification-token";
import { startPromoterSession } from "@/lib/promoter-auth";

export default async function PromoterVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim();

  if (!token) {
    return <VerifyError message="No verification token provided." />;
  }

  const user = await consumeVerificationToken(token);

  if (!user) {
    return (
      <VerifyError message="This verification link is invalid or has expired. Please sign up again." />
    );
  }

  if (user.role !== "ORGANIZER") {
    return <VerifyError message="This link is not valid for a promoter account." />;
  }

  await startPromoterSession(user.id);
  redirect("/promoter");
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
          href="/account/resend-verification?audience=promoter"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Send a new verification link
        </Link>
      </div>
    </div>
  );
}
