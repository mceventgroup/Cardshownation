import Link from "next/link";
import { isGoogleAuthConfigured } from "@/lib/google-oauth";
import { sanitizeLocalRedirectTarget } from "@/lib/url";

export function GoogleSignInLink({ from = "/account" }: { from?: string }) {
  if (!isGoogleAuthConfigured()) return null;

  const destination = sanitizeLocalRedirectTarget(from, "/account");
  return (
    <div className="mt-8">
      <Link
        href={`/api/auth/google/start?from=${encodeURIComponent(destination)}`}
        className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
      >
        <span aria-hidden className="text-base font-bold text-blue-600">G</span>
        Continue with Google
      </Link>
      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        Or use email and password
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}
