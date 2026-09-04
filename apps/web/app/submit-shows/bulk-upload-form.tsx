"use client";

import { useActionState, useRef, useState } from "react";
import Papa from "papaparse";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import {
  getMissingBulkHeaders,
  MAX_PUBLIC_BULK_UPLOAD_BYTES,
  MAX_PUBLIC_BULK_UPLOAD_ROWS,
  normalizeBulkHeader,
  rowsFromBulkSpreadsheet,
  validatePublicBulkRows,
  type BulkRowError,
  type PublicBulkCsvRow,
} from "@/lib/public-bulk-upload";
import { submitBulkShowsAction, type PublicBulkUploadState } from "./actions";

type PreviewRow = PublicBulkCsvRow & { error?: string };
const initialPublicBulkUploadState: PublicBulkUploadState = {
  approved: 0,
  pending: 0,
  duplicates: 0,
  errors: [],
  message: null,
  success: false,
};

export function PublicBulkUploadForm() {
  const [state, action, pending] = useActionState(submitBulkShowsAction, initialPublicBulkUploadState);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  async function readFile(file: File) {
    setPreview([]);
    setParseError(null);
    setFileName(file.name);
    if (file.size > MAX_PUBLIC_BULK_UPLOAD_BYTES) {
      setParseError("That file is too large. Keep the spreadsheet under 750 KB.");
      return;
    }
    let headers: string[] = [];
    let rows: PublicBulkCsvRow[] = [];
    if (/\.xlsx$/i.test(file.name)) {
      try {
        const { readSheet } = await import("read-excel-file/browser");
        const grid = await readSheet(file);
        ({ headers, rows } = rowsFromBulkSpreadsheet(grid));
      } catch {
        setParseError("We could not read that Excel file. Download a fresh template and try again.");
        return;
      }
    } else {
      const parsed = Papa.parse<Omit<PublicBulkCsvRow, "rowNumber">>(await file.text(), {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: normalizeBulkHeader,
      });
      if (parsed.errors.length > 0) {
        setParseError(parsed.errors[0]?.message ?? "We could not read that CSV file.");
        return;
      }
      headers = parsed.meta.fields ?? [];
      rows = parsed.data.map((row, index) => ({ ...row, rowNumber: index + 2 }));
    }
    const missing = getMissingBulkHeaders(headers);
    if (missing.length > 0) {
      setParseError(`Missing required columns: ${missing.join(", ")}. The template has everything you need.`);
      return;
    }
    rows = rows.filter((row) => !String(row.title ?? "").trim().toUpperCase().startsWith("EXAMPLE"));
    if (rows.length > MAX_PUBLIC_BULK_UPLOAD_ROWS) {
      setParseError("Upload up to 100 shows at a time. Split larger schedules into separate files.");
      return;
    }
    const validation = validatePublicBulkRows(rows);
    const errors = new Map<number, string>(validation.errors.map((error) => [error.row, error.message]));
    setPreview(rows.map((row) => ({ ...row, error: errors.get(row.rowNumber) })));
  }

  const validCount = preview.filter((row) => !row.error).length;
  const issueCount = preview.length - validCount;

  return (
    <form action={action} className="mt-8 space-y-6" data-analytics-form="submit-shows-bulk">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-700">Step 1</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Download and fill out the template</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              The guided Excel version has dropdowns, required columns highlighted, and a help tab. A plain CSV is also available.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <a href="/card-show-nation-guided-upload.xlsx" download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"><Download className="h-4 w-4" aria-hidden />Guided Excel template</a>
            <a href="/show-upload-template.csv" download className="text-center text-xs font-semibold text-slate-500 underline underline-offset-4 hover:text-brand-700">Plain CSV template</a>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4"><strong className="text-slate-800">Required:</strong><p className="mt-1 text-slate-600">Show name, date, city, state, and venue</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><strong className="text-slate-800">Built-in guidance:</strong><p className="mt-1 text-slate-600">Dropdowns for state, times, category, and Yes/No</p></div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-semibold text-brand-700">Step 2</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Choose your completed spreadsheet</h2>
        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-300 hover:bg-brand-50">
          <FileSpreadsheet className="h-10 w-10 text-brand-600" aria-hidden />
          <span className="mt-3 font-semibold text-slate-800">{fileName || "Choose an Excel or CSV file"}</span>
          <span className="mt-1 text-sm text-slate-500">.xlsx or .csv · up to 100 shows</span>
          <input ref={fileRef} name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv" required className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
        </label>
        {parseError && <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{parseError}</p>}
      </section>

      {preview.length > 0 && (
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div><p className="text-sm font-semibold text-brand-700">Step 3</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Review before submitting</h2></div>
            <div className="flex gap-2 text-xs font-semibold"><span className="rounded-full bg-green-50 px-3 py-1.5 text-green-700">{validCount} ready</span>{issueCount > 0 && <span className="rounded-full bg-red-50 px-3 py-1.5 text-red-700">{issueCount} need fixes</span>}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Show</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Venue</th><th className="px-4 py-3">Category / admission</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{preview.slice(0, 50).map((row) => <tr key={row.rowNumber} className={row.error ? "bg-red-50/40" : ""}><td className="px-4 py-3 text-slate-400">{row.rowNumber}</td><td className="px-4 py-3 font-medium text-slate-900">{row.title || "—"}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.startDate || "—"}{row.endDate && row.endDate !== row.startDate ? ` – ${row.endDate}` : ""}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.city || "—"}{row.state ? `, ${row.state.toUpperCase()}` : ""}</td><td className="px-4 py-3 text-slate-600">{row.venueName || "—"}</td><td className="px-4 py-3 text-slate-600"><span className="block">{row.categories || "No category"}</span><span className="text-xs text-slate-400">{["yes", "true", "1", "free"].includes(String(row.isFree ?? "").toLowerCase()) ? "Free admission" : row.admissionPrice || "Admission not specified"}</span></td><td className="max-w-xs px-4 py-3">{row.error ? <span className="text-red-700">{row.error}</span> : <span className="inline-flex items-center gap-1 font-medium text-green-700"><CheckCircle2 className="h-4 w-4" aria-hidden />Ready</span>}</td></tr>)}</tbody>
            </table>
          </div>
          {preview.length > 50 && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing the first 50 of {preview.length} rows. All valid rows will be submitted.</p>}
        </section>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-semibold text-brand-700">Contact information</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="bulkSubmitterEmail" className="mb-2 block text-sm font-medium text-slate-700">Private email <span className="text-red-600">*</span></label><input id="bulkSubmitterEmail" name="submitterEmail" type="email" required autoComplete="email" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none" placeholder="you@example.com" /><p className="mt-2 text-xs text-slate-500">Used only for reviewing your listings. It is not shown publicly.</p></div>
          <div><label htmlFor="bulkSubmitterName" className="mb-2 block text-sm font-medium text-slate-700">Your or your organization’s name</label><input id="bulkSubmitterName" name="submitterName" type="text" maxLength={120} autoComplete="name" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none" placeholder="Kansas Card Show" /></div>
        </div>
        <div className="hidden" aria-hidden><label htmlFor="bulkCompanyWebsite">Leave blank</label><input id="bulkCompanyWebsite" name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" /></div>
        <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-slate-500">Valid shows enter the same moderation queue as individual submissions. Existing matches are skipped automatically.</p>
          <button type="submit" disabled={pending || validCount === 0 || Boolean(parseError)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            {pending ? "Submitting schedule…" : `Submit ${validCount || "valid"} show${validCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </section>

      {state.message && <UploadResults state={state} />}
    </form>
  );
}

function UploadResults({ state }: { state: PublicBulkUploadState }) {
  const accepted = state.approved + state.pending;
  return <section aria-live="polite" className={`rounded-[2rem] border p-5 shadow-sm sm:p-7 ${state.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
    <div className="flex items-start gap-3">{state.success ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-700" aria-hidden /> : <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden />}<div><h2 className="text-lg font-semibold text-slate-950">{state.success ? "Schedule submitted" : "Upload needs attention"}</h2><p className="mt-1 text-sm leading-6 text-slate-700">{state.message}</p></div></div>
    {(accepted > 0 || state.duplicates > 0) && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><ResultStat label="Sent for review" value={state.pending} /><ResultStat label="Published" value={state.approved} /><ResultStat label="Existing matches" value={state.duplicates} /><ResultStat label="Rows with issues" value={state.errors.length} /></div>}
    {state.errors.length > 0 && <div className="mt-5 rounded-2xl bg-white/80 p-4"><p className="text-sm font-semibold text-slate-800">Rows to fix</p><ul className="mt-2 space-y-1 text-sm text-slate-700">{state.errors.slice(0, 20).map((error: BulkRowError) => <li key={`${error.row}-${error.message}`}><strong>Row {error.row}:</strong> {error.message}</li>)}</ul></div>}
  </section>;
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-white/80 p-4"><p className="text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-600">{label}</p></div>;
}
