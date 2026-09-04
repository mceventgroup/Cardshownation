import Link from "next/link";
import { redirect } from "next/navigation";
import { BulkSubmissionForm } from "@/components/moderation/bulk-submission-form";
import { requireModeratorSession } from "@/lib/moderator-auth";
import {
  approveShowSubmission,
  DuplicateSubmissionError,
  getModeratorVisibleSubmissions,
  rejectShowSubmission,
} from "@/lib/submissions";

export const dynamic = "force-dynamic";

async function bulkModerateSubmissions(formData: FormData) {
  "use server";
  const session = await requireModeratorSession("/moderator/submissions");
  const visible = await getModeratorVisibleSubmissions(session.user.id);
  const pendingIds = new Set(
    visible.filter((submission) => submission.status === "PENDING").map((submission) => submission.id)
  );
  const selectedIds = Array.from(
    new Set(
      formData
        .getAll("submissionIds")
        .filter((value): value is string => typeof value === "string" && pendingIds.has(value))
    )
  );
  const requestedAction = formData.get("bulkAction");
  const action = requestedAction === "reject" ? "reject" : "approve";
  const ids = requestedAction === "approveAll" ? [...pendingIds] : selectedIds;
  const noteValue = formData.get("bulkNotes");
  const notes = typeof noteValue === "string" ? noteValue.trim().slice(0, 500) || null : null;
  let processed = 0;
  let skipped = 0;

  for (const id of ids) {
    try {
      const pendingSubmission = visible.find((submission) => submission.id === id);
      const isClaim = (pendingSubmission?.payloadJson as Record<string, unknown> | undefined)?.submissionIntent === "CLAIM_OR_UPDATE";
      if (action === "approve" && isClaim) {
        skipped += 1;
        continue;
      }
      if (action === "reject") {
        await rejectShowSubmission(id, notes ?? "Rejected during bulk review.", {
          reviewerId: session.user.id,
          reviewerRole: "MODERATOR",
        });
      } else {
        await approveShowSubmission(id, {
          reviewerId: session.user.id,
          reviewerRole: "MODERATOR",
          notes,
        });
      }
      processed += 1;
    } catch (error) {
      if (error instanceof DuplicateSubmissionError && action === "approve") {
        try {
          await rejectShowSubmission(
            id,
            `Rejected during bulk approval: duplicate of show ${error.duplicateId}.`,
            { reviewerId: session.user.id, reviewerRole: "MODERATOR" }
          );
          processed += 1;
          continue;
        } catch (rejectError) {
          console.error("[moderator moderation] duplicate rejection failed", { submissionId: id, rejectError });
        }
      } else {
        console.error("[moderator moderation] bulk action failed", { submissionId: id, error });
      }
      skipped += 1;
    }
  }

  redirect(`/moderator/submissions?bulk=${action}&processed=${processed}&skipped=${skipped}`);
}

export default async function ModeratorSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ bulk?: string; processed?: string; skipped?: string }>;
}) {
  const session = await requireModeratorSession("/moderator/submissions");
  const sp = await searchParams;

  const submissions = await getModeratorVisibleSubmissions(session.user.id);
  const pending = submissions.filter((submission) => submission.status === "PENDING");
  const reviewed = submissions.filter(
    (submission) =>
      submission.status !== "PENDING" && submission.reviewerId === session.user.id
  );

  return (
    <div className="p-6 lg:p-10">
      <h1 className="mb-8 text-2xl font-bold text-slate-900">
        Review queue
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

      <SubmissionTable rows={pending} title="Pending Review" emptyText="All caught up." bulkAction={bulkModerateSubmissions} />

      <div className="mt-10">
        <SubmissionTable
          rows={reviewed.slice(0, 30)}
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
  rows: any[];
  title: string;
  emptyText: string;
  bulkAction?: (formData: FormData) => void | Promise<void>;
}) {
  const table = (
    <>
    <div className="grid gap-3 md:hidden">
      {rows.map((submission) => {
        const payload = submission.payloadJson as Record<string, unknown>;
        const moderationStatus = submission.organizer?.moderationStatus ?? "NEW";
        return (
          <article key={submission.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{typeof payload.showName === "string" ? payload.showName : "Unnamed"}</p>
                <p className="mt-1 text-sm text-slate-500">{String(payload.city ?? "")}{payload.state ? `, ${String(payload.state)}` : ""}</p>
                {payload.submissionIntent === "CLAIM_OR_UPDATE" && <p className="mt-1 text-xs font-semibold text-amber-700">Claim/update · review individually</p>}
              </div>
              {bulkAction ? (
                <label className="flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                  <input type="checkbox" name="submissionIds" value={submission.id} aria-label={`Select ${String(payload.showName ?? "submission")}`} />
                  Pick
                </label>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${moderationStatus === "TRUSTED" ? "bg-green-50 text-green-700" : moderationStatus === "BLOCKED" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>{moderationStatus.toLowerCase()} organizer</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${submission.status === "PENDING" ? "bg-yellow-50 text-yellow-700" : submission.status === "APPROVED" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{submission.status.toLowerCase()}</span>
              <span className="text-xs text-slate-400">{new Date(submission.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <Link href={`/moderator/submissions/${submission.id}`} className="inline-flex w-full items-center justify-center rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                {submission.status === "PENDING" ? "Edit and review" : "View submission"}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {bulkAction && <th className="w-12 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Pick</th>}
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Show</th>
            <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Location</th>
            <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Submitted</th>
            <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Organizer</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((submission) => {
            const payload = submission.payloadJson as Record<string, unknown>;
            const moderationStatus = submission.organizer?.moderationStatus ?? "NEW";
            return (
              <tr key={submission.id} className="transition-colors hover:bg-slate-50">
                {bulkAction && <td className="px-4 py-3"><input type="checkbox" name="submissionIds" value={submission.id} aria-label={`Select ${String(payload.showName ?? "submission")}`} /></td>}
                <td className="px-4 py-3"><p className="font-medium text-slate-900">{typeof payload.showName === "string" ? payload.showName : "Unnamed"}</p><p className="text-xs text-slate-400">{submission.submitterName}{payload.submissionIntent === "CLAIM_OR_UPDATE" ? " · Claim/update — review individually" : ""}</p></td>
                <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{String(payload.city ?? "")}, {String(payload.state ?? "")}</td>
                <td className="hidden px-4 py-3 text-xs text-slate-400 md:table-cell">{new Date(submission.createdAt).toLocaleDateString()}</td>
                <td className="hidden px-4 py-3 lg:table-cell"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${moderationStatus === "TRUSTED" ? "bg-green-50 text-green-700" : moderationStatus === "BLOCKED" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>{moderationStatus.toLowerCase()}</span></td>
                <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${submission.status === "PENDING" ? "bg-yellow-50 text-yellow-700" : submission.status === "APPROVED" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{submission.status.toLowerCase()}</span></td>
                <td className="px-4 py-3 text-right"><Link href={`/moderator/submissions/${submission.id}`} className="text-sm font-medium text-brand-600 hover:underline">{submission.status === "PENDING" ? "Edit / review" : "View"}</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-slate-700">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
          {emptyText}
        </div>
      ) : bulkAction ? (
        <BulkSubmissionForm action={bulkAction} rowCount={rows.length}>
          {table}
        </BulkSubmissionForm>
      ) : table}
    </div>
  );
}
