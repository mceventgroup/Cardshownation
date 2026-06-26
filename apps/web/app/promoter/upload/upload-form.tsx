"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Download, FileUp, Loader2 } from "lucide-react";
import { uploadPromoterShowsCsvAction, type PromoterUploadState } from "./actions";

const initialState: PromoterUploadState = {
  approved: 0,
  pending: 0,
  skipped: 0,
  errors: [],
  message: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
      {pending ? "Uploading..." : "Upload CSV"}
    </button>
  );
}

export function PromoterUploadForm() {
  const [state, action] = useActionState(uploadPromoterShowsCsvAction, initialState);

  return (
    <div className="space-y-6">
      <form action={action} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Bulk show upload</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload one CSV to add multiple shows at once. Trusted cities will auto-approve based on your account settings. Other rows will become pending submissions for admin review.
            </p>
          </div>
          <a
            href="/show-upload-template.csv"
            download
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download CSV template
          </a>
        </div>

        <div className="mt-6">
          <label htmlFor="file" className="mb-2 block text-sm font-medium text-slate-700">
            CSV file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
          <p>
            Required columns: <span className="font-medium">title, startDate, endDate, city, state, venueName</span>
          </p>
          <p>
            Optional columns: <span className="font-medium">startTimeLabel, endTimeLabel, venueAddress, categories, description, tableCount, vendorDetails, websiteUrl, facebookUrl, isFree, admissionPrice, admissionNotes, parkingInfo</span>
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <SubmitButton />
        </div>
      </form>

      {state.message && (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-950">Results</h2>
          <p className="mt-2 text-sm text-slate-600">{state.message}</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <StatCard label="Approved" value={String(state.approved)} />
            <StatCard label="Pending" value={String(state.pending)} />
            <StatCard label="Skipped" value={String(state.skipped)} />
            <StatCard label="Errors" value={String(state.errors.length)} />
          </div>

          {state.errors.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Row
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.errors.map((error) => (
                    <tr key={`${error.row}-${error.message}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">{error.row}</td>
                      <td className="px-4 py-3 text-slate-600">{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
