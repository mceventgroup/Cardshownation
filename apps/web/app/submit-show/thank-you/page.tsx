import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Show Submitted",
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <div className="container-narrow py-20 text-center">
      <div className="flex justify-center mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Show Submitted!</h1>
      <p className="mt-3 text-slate-500 max-w-md mx-auto">
        Thanks for submitting your show. We review listings within 24 hours and
        will email you once it&apos;s approved and live.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/card-shows"
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Browse Shows
        </Link>
        <Link
          href="/submit-show"
          className="rounded-lg border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Submit Another Show
        </Link>
      </div>
    </div>
  );
}
