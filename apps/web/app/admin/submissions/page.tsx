import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  approveShowSubmission,
  DuplicateSubmissionError,
  getAllSubmissions,
  rejectShowSubmission,
} from "@/lib/submissions";

export const dynamic = "force-dynamic";

async function bulkModerateSubmissions(formData: FormData) {
  "use server";
  const session = await requireAdminSession("/admin/submissions");
  const action = formData.get("bulkAction") === "reject" ? "reject" : "approve";
  const notesValue = formData.get("bulkNotes");
  const notes = typeof notesValue === "string" ? notesValue.trim().slice(0, 500) || null : null;
  const submissionIds = Array.from(
    new Set(
      formData
        .getAll("submissionIds")
        .filter((value): value is string => typeof value === "string" && value.length <= 100)
    )
  ).slice(0, 50);

  let processed = 0;
  let skipped = 0;
  for (const submissionId of submissionIds) {
    try {
      if (action === "reject") {
        await rejectShowSubmission(submissionId, notes ?? "Rejected during bulk review.", {
          reviewerId: session.user.id,
          reviewerRole: "ADMIN",
        });
      } else {
        await approveShowSubmission(submissionId, {
          reviewerId: session.user.id,
          reviewerRole: "ADMIN",
          notes,
        });
      }
      processed += 1;
    } catch (error) {
      if (!(error instanceof DuplicateSubmissionError)) {
        console.error("[admin moderation] bulk action failed", { submissionId, error });
      }
      skipped += 1;
    }
  }

  redirect(
    `/admin/submissions?bulk=${action}&processed=${processed}&skipped=${skipped}`
  );
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ bulk?: string; processed?: string; skipped?: string }>;
}) {
  await requireAdminSession("/admin/submissions");
  const sp = await searchParams;

  const submissions = await getAllSubmissions();
  const pending = submissions.filter((submission) => submission.status === "PENDING");
  const reviewed = submissions.filter((submission) => submission.status !== "PENDING");
  const withTrust = submissions.map((submission) => ({
    submission,
    moderationStatus:
      "organizer" in submission && submission.organizer
        ? submission.organizer.moderationStatus
        : "NEW",
  }));
  const pendingRows = withTrust.filter(({ submission }) => submission.status === "PENDING");
  const reviewedRows = withTrust.filter(({ submission }) => submission.status !== "PENDING");

  return (
    <div className="p-6 lg:p-10">
      <h1 className="mb-8 text-2xl font-bold text-slate-900">
        Submissions
        {pending.length > 0 && (
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-yellow-100 px-2.5 py-1 text-sm font-medium text-yellow-700">
            {pending.length} pending
          </span>
        )}
      </h1>

      {sp.bulk && (
        <p className="mb-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Bulk {sp.bulk}: {Number(sp.processed ?? 0)} processed
          {Number(sp.skipped ?? 0) > 0 ? `, ${Number(sp.skipped)} skipped` : ""}.
        </p>
      )}

      <SubmissionTable
        rows={pendingRows}
        title="Pending Review"
        emptyText="All caught up."
        bulkAction={bulkModerateSubmissions}
      />

      <div className="mt-10">
        <SubmissionTable
          rows={reviewedRows.slice(0, 30)}
          title="Recently Reviewed"
          emptyText="No reviewed submissions yet."
        />
      </div>
    </div>
  );
}

function SubmissionTable({
  rows,
  title,
  emptyText,
  bulkAction,
}: {
  rows: Array<{ submission: any; moderationStatus: string }>;
  title: string;
  emptyText: string;
  bulkAction?: (formData: FormData) => void | Promise<void>;
}) {
  const table = (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {bulkAction && (
              <th className="w-12 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pick
              </th>
            )}
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Show</th>
            <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Location</th>
            <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Submitted</th>
            <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Organizer</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ submission, moderationStatus }) => {
            const payload = submission.payloadJson as Record<string, unknown>;
            return (
              <tr key={submission.id} className="transition-colors hover:bg-slate-50">
                {bulkAction && (
                  <td className="px-4 py-3">
                    <input type="checkbox" name="submissionIds" value={submission.id} aria-label={`Select ${String(payload.showName ?? "submission")}`} />
                  </td>
                )}
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{typeof payload.showName === "string" ? payload.showName : "Unnamed"}</p>
                  <p className="text-xs text-slate-400">{submission.submitterName}</p>
                </td>
                <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{String(payload.city ?? "")}, {String(payload.state ?? "")}</td>
                <td className="hidden px-4 py-3 text-xs text-slate-400 md:table-cell">{new Date(submission.createdAt).toLocaleDateString()}</td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${moderationStatus === "TRUSTED" ? "bg-green-50 text-green-700" : moderationStatus === "BLOCKED" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {moderationStatus.toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${submission.status === "PENDING" ? "bg-yellow-50 text-yellow-700" : submission.status === "APPROVED" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    {submission.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/submissions/${submission.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    {submission.status === "PENDING" ? "Edit / review" : "View"}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-slate-700">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
          {emptyText}
        </div>
      ) : bulkAction ? (
        <form action={bulkAction} className="space-y-3">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
            <input name="bulkNotes" placeholder="Optional shared review note" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            <button name="bulkAction" value="approve" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Approve selected</button>
            <button name="bulkAction" value="reject" className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Reject selected</button>
          </div>
          {table}
        </form>
      ) : table}
    </div>
  );
}
