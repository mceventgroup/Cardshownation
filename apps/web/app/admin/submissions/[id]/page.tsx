import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { SubmissionEditForm } from "@/components/moderation/submission-edit-form";
import { readSubmissionPayloadEdits } from "@/lib/submission-edit";
import {
  approveShowSubmission,
  DuplicateSubmissionError,
  getSubmissionById,
  rejectShowSubmission,
  setOrganizerModerationStatus,
  updatePendingSubmissionPayload,
} from "@/lib/submissions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export const dynamic = "force-dynamic";

async function approveSubmission(submissionId: string, formData: FormData) {
  "use server";
  const session = await requireAdminSession(`/admin/submissions/${submissionId}`);
  const grantAutoApproval = formData.get("grantAutoApproval") === "on";
  const submission = await getSubmissionById(submissionId);
  if (!submission) return;

  if (grantAutoApproval) {
    const organizerId = (submission.payloadJson as Record<string, unknown>).organizerId;
    if (typeof organizerId === "string") {
      await setOrganizerModerationStatus(organizerId, "TRUSTED", {
        actorId: session.user.id,
        actorRole: "ADMIN",
      });
    }
  }

  let show;
  try {
    show = await approveShowSubmission(submissionId, {
      reviewerId: session.user.id,
      reviewerRole: "ADMIN",
    });
  } catch (error) {
    if (error instanceof DuplicateSubmissionError) {
      redirect(`/admin/submissions/${submissionId}?error=duplicate`);
    }
    throw error;
  }
  if (!show) return;
  redirect(`/admin/shows/${show.id}`);
}

async function saveSubmissionEdits(submissionId: string, formData: FormData) {
  "use server";
  const session = await requireAdminSession(`/admin/submissions/${submissionId}`);
  const updates = readSubmissionPayloadEdits(formData);
  if (!updates) redirect(`/admin/submissions/${submissionId}?error=validation`);

  try {
    await updatePendingSubmissionPayload(submissionId, updates, {
      reviewerId: session.user.id,
      reviewerRole: "ADMIN",
    });
  } catch (error) {
    if (error instanceof DuplicateSubmissionError) {
      redirect(`/admin/submissions/${submissionId}?error=duplicate`);
    }
    throw error;
  }
  redirect(`/admin/submissions/${submissionId}?saved=1`);
}

async function rejectSubmission(submissionId: string, formData: FormData) {
  "use server";
  const session = await requireAdminSession(`/admin/submissions/${submissionId}`);
  const notesValue = formData.get("notes");
  const notes = typeof notesValue === "string" ? notesValue.trim() || null : null;
  await rejectShowSubmission(submissionId, notes, {
    reviewerId: session.user.id,
    reviewerRole: "ADMIN",
  });
  redirect("/admin/submissions");
}

export default async function ReviewSubmissionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdminSession(`/admin/submissions/${id}`);
  const submission = await getSubmissionById(id);
  if (!submission) notFound();

  const payload = submission.payloadJson as Record<string, unknown>;
  const isPending = submission.status === "PENDING";
  const hasOrganizerApprovalContext = typeof payload.organizerId === "string";
  const moderationStatus =
    "organizer" in submission && submission.organizer
      ? submission.organizer.moderationStatus
      : "NEW";
  const approveWithId = approveSubmission.bind(null, submission.id);
  const rejectWithId = rejectSubmission.bind(null, submission.id);
  const editWithId = saveSubmissionEdits.bind(null, submission.id);
  const submittedFields: [string, unknown][] = [
    ["Show Name", payload.showName],
    ["Start Date", payload.startDate],
    ["End Date", payload.endDate],
    ["Start Time", payload.startTimeLabel],
    ["End Time", payload.endTimeLabel],
    ["City", payload.city],
    ["State", payload.state],
    ["Venue Name", payload.venueName],
    ["Venue Address", payload.venueAddress],
    [
      "Categories",
      Array.isArray(payload.categories)
        ? payload.categories.join(", ")
        : payload.categories,
    ],
    ["Organizer Name", payload.organizerName],
    ["Organizer Email", payload.organizerEmail],
    ["Description", payload.description],
    ["Table Count", payload.tableCount],
    ["Vendor Details", payload.vendorDetails],
    ["Website", payload.websiteUrl],
    ["Facebook", payload.facebookUrl],
    [
      "Admission",
      payload.isFree
        ? "Free"
        : `Paid - ${String(payload.admissionPrice ?? "no price given")}`,
    ],
    ["Admission Notes", payload.admissionNotes],
    ["Parking", payload.parkingInfo],
  ];
  const reviewer = "reviewer" in submission ? submission.reviewer : null;

  return (
    <div className="max-w-3xl p-6 lg:p-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/admin/submissions" className="text-sm text-brand-600 hover:underline">
          ← Back to Submissions
        </Link>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            submission.status === "PENDING"
              ? "bg-yellow-50 text-yellow-700"
              : submission.status === "APPROVED"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
          }`}
        >
          {submission.status}
        </span>
      </div>

      <h1 className="mb-1 text-2xl font-bold text-slate-900">
        {typeof payload.showName === "string" ? payload.showName : "Unnamed Show"}
      </h1>
      <p className="mb-8 text-slate-500">
        Submitted by {submission.submitterName} ({submission.submitterEmail}) on{" "}
        {new Date(submission.createdAt).toLocaleDateString()}
      </p>

      {sp.error && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error === "duplicate"
            ? "A matching show or pending submission already exists."
            : "Check the edited fields and try again."}
        </p>
      )}
      {sp.saved === "1" && (
        <p className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Submission details saved.
        </p>
      )}

      {reviewer && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Reviewed by {reviewer.name ?? reviewer.email} ({reviewer.role.toLowerCase()})
          {submission.notes ? ` · ${submission.notes}` : ""}
        </div>
      )}

      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Submitted Details</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {submittedFields
            .filter(([, value]) => value !== null && value !== undefined && value !== "")
            .map(([label, value]) => (
              <div key={String(label)} className="flex gap-4 px-5 py-3">
                <span className="w-36 shrink-0 pt-0.5 text-xs font-medium text-slate-400">
                  {label}
                </span>
                <span className="break-words text-sm text-slate-900">
                  {String(value)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {isPending && <SubmissionEditForm payload={payload} action={editWithId} />}

      {hasOrganizerApprovalContext && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Organizer moderation status</h2>
          <p className="mt-2 text-sm text-slate-600">
            {moderationStatus === "TRUSTED"
              ? "Trusted organizer: future non-duplicate submissions publish automatically."
              : moderationStatus === "BLOCKED"
                ? "Blocked organizer: new submissions are prevented."
                : "New organizer: submissions remain pending until reviewed."}
          </p>
        </div>
      )}

      {isPending ? (
        <div className="space-y-4">
          <form action={approveWithId}>
            {hasOrganizerApprovalContext && moderationStatus !== "TRUSTED" && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="grantAutoApproval"
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>
                    Mark this organizer Trusted so future non-duplicate shows auto-publish.
                  </span>
                </label>
              </div>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              Approve and Publish Show
            </button>
          </form>

          <form action={rejectWithId} className="space-y-3">
            <textarea
              name="notes"
              rows={3}
              placeholder="Optional: reason for rejection..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              Reject Submission
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">
            This submission has already been{" "}
            <strong>{submission.status.toLowerCase()}</strong>.
            {submission.notes && <> Reason: {submission.notes}</>}
          </p>
          {submission.reviewedShowId && (
            <Link
              href={`/admin/shows/${submission.reviewedShowId}`}
              className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
            >
              View approved show →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
