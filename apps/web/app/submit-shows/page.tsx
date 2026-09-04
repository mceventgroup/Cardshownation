import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { PublicBulkUploadForm } from "./bulk-upload-form";

export const metadata: Metadata = {
  title: "Submit Multiple Card Shows",
  description: "Upload a full card-show schedule to Card Show Nation from one simple spreadsheet. No account required.",
  alternates: { canonical: "/submit-shows" },
};

export default function SubmitMultipleShowsPage() {
  return (
    <div className="container-narrow py-6 sm:py-10">
      <Link href="/submit-show" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"><ArrowLeft className="h-4 w-4" aria-hidden />Submitting one show instead?</Link>
      <div className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Bulk show submission</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Add your whole show schedule at once</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Download the template, add one show per row, and review everything before submitting. No account is required.</p>
        <ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-3"><li className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-600" aria-hidden />Up to 100 shows</li><li className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-600" aria-hidden />Errors shown by row</li><li className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-600" aria-hidden />Duplicates skipped</li></ul>
      </div>
      <PublicBulkUploadForm />
    </div>
  );
}
