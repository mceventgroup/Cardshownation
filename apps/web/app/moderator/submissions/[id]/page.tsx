import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireModeratorSession } from "@/lib/moderator-auth";
import { SubmissionEditForm } from "@/components/moderation/submission-edit-form";
import { DuplicateReviewCard } from "@/components/moderation/duplicate-review-card";
import { readSubmissionPayloadEdits } from "@/lib/submission-edit";
import {
  approveShowSubmission,
  DuplicateSubmissionError,
  getModeratorVisibleSubmissionById,
  getDuplicateReview,
  mergeDuplicateSubmission,
  rejectShowSubmission,
  requestSubmissionCorrections,
  updatePendingSubmissionPayload,
} from "@/lib/submissions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export const dynamic = "force-dynamic";

function buildModeratorNote(
  recommendTrust: boolean,
  city: string | null,
  state: string | null,
  customNote: string | null
) {
  const parts: string[] = [];

  if (recommendTrust && city && state) {
    parts.push(`Moderator recommendation: consider marking this organizer Trusted. Reviewed show market: ${city}, ${state}.`);
  }

  if (customNote) {
    parts.push(customNote);
  }

  return parts.join(" ");
}

async function approveSubmission(submissionId: string, formData: FormData) {
  "use server";
  const session = await requireModeratorSession(`/moderator/submissions/${submissionId}`);
  const submission = await getModeratorVisibleSubmissionById(submissionId, session.user.id);
  if (!submission) return;

  const payload = submission.payloadJson as Record<string, unknown>;
  const noteValue = formData.get("notes");
  const recommendTrust = formData.get("recommendTrust") === "on";
  const customNote = typeof noteValue === "string" ? noteValue.trim() || null : null;
  const note = buildModeratorNote(
    recommendTrust,
    typeof payload.city === "string" ? payload.city : null,
    typeof payload.state === "string" ? payload.state : null,
    customNote
  );

  let show;
  try {
    show = await approveShowSubmission(submissionId, {
      reviewerId: session.user.id,
      reviewerRole: "MODERATOR",
      notes: note || null,
      allowLikelyDuplicate: formData.get("confirmDistinct") === "yes",
    });
  } catch (error) {
    if (error instanceof DuplicateSubmissionError) {
      redirect(`/moderator/submissions/${submissionId}?error=duplicate`);
    }
    throw error;
  }
  if (!show) return;

  redirect(`/moderator/submissions/${submissionId}`);
}

async function mergeSubmission(submissionId: string) {
  "use server";
  const session = await requireModeratorSession(`/moderator/submissions/${submissionId}`);
  const visible = await getModeratorVisibleSubmissionById(submissionId, session.user.id);
  if (!visible || visible.status !== "PENDING") return;
  await mergeDuplicateSubmission(submissionId, { reviewerId: session.user.id, reviewerRole: "MODERATOR" });
  redirect(`/moderator/submissions/${submissionId}?saved=merged`);
}

async function saveSubmissionEdits(submissionId: string, formData: FormData) {
  "use server";
  const session = await requireModeratorSession(`/moderator/submissions/${submissionId}`);
  const visible = await getModeratorVisibleSubmissionById(submissionId, session.user.id);
  if (!visible || visible.status !== "PENDING") return;
  const updates = readSubmissionPayloadEdits(formData);
  if (!updates) redirect(`/moderator/submissions/${submissionId}?error=validation`);

  try {
    await updatePendingSubmissionPayload(submissionId, updates, {
      reviewerId: session.user.id,
      reviewerRole: "MODERATOR",
    });
  } catch (error) {
    if (error instanceof DuplicateSubmissionError) {
      redirect(`/moderator/submissions/${submissionId}?error=duplicate`);
    }
    throw error;
  }
  redirect(`/moderator/submissions/${submissionId}?saved=1`);
}

async function rejectSubmission(submissionId: string, formData: FormData) {
  "use server";
  const session = await requireModeratorSession(`/moderator/submissions/${submissionId}`);
  const notesValue = formData.get("notes");
  const notes = typeof notesValue === "string" ? notesValue.trim() || null : null;
  await rejectShowSubmission(submissionId, notes, {
    reviewerId: session.user.id,
    reviewerRole: "MODERATOR",
  });
  redirect("/moderator/submissions");
}

async function requestCorrections(submissionId: string, formData: FormData) {
  "use server";
  const session = await requireModeratorSession(`/moderator/submissions/${submissionId}`);
  const notes = String(formData.get("notes") ?? "").trim();
  if (!notes) redirect(`/moderator/submissions/${submissionId}?error=corrections-note`);
  await requestSubmissionCorrections(submissionId, notes, { reviewerId: session.user.id, reviewerRole: "MODERATOR" });
  redirect(`/moderator/submissions/${submissionId}?saved=corrections`);
}

export default async function ModeratorSubmissionDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await requireModeratorSession(`/moderator/submissions/${id}`);
  const submission = await getModeratorVisibleSubmissionById(id, session.user.id);
  if (!submission) notFound();

  const payload = submission.payloadJson as Record<string, unknown>;
  const moderationStatus =
    "organizer" in submission && submission.organizer
      ? submission.organizer.moderationStatus
      : "NEW";
  const isPending = submission.status === "PENDING";
  const approveWithId = approveSubmission.bind(null, submission.id);
  const rejectWithId = rejectSubmission.bind(null, submission.id);
  const editWithId = saveSubmissionEdits.bind(null, submission.id);
  const correctionsWithId = requestCorrections.bind(null, submission.id);
  const mergeWithId = mergeSubmission.bind(null, submission.id);
  const duplicateReview = await getDuplicateReview(payload, submission.id);
  const hasLikelyDuplicate = (duplicateReview?.score ?? 0) >= 72;
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
      Array.isArray(payload.categories) ? payload.categories.join(", ") : payload.categories,
    ],
    ["Organizer Name", payload.organizerName],
    ["Organizer Email", payload.organizerEmail],
    ["Description", payload.description],
    ["Table Count", payload.tableCount],
    ["Vendor Details", payload.vendorDetails],
    ["Website", payload.websiteUrl],
    ["Facebook", payload.facebookUrl],
  ];

  return (
    <div className="max-w-3xl p-6 lg:p-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/moderator/submissions" className="text-sm text-brand-600 hover:underline">
          ← Back to queue
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
        <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error === "duplicate"
            ? "A matching show or pending submission already exists."
            : sp.error === "corrections-note" ? "Add a note explaining what needs to be corrected."
            : "Check the edited fields and try again."}
        </p>
      )}
      {sp.saved && (
        <p className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {sp.saved === "corrections" ? "Correction request emailed to the submitter." : sp.saved === "merged" ? "Safe missing details were merged into the existing record." : "Submission details saved."}
        </p>
      )}

      <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Promoter trust context</h2>
        <p className="mt-2 text-sm text-slate-600">
          {moderationStatus === "TRUSTED"
            ? "This organizer is Trusted; future non-duplicate submissions auto-publish."
            : moderationStatus === "BLOCKED"
              ? "This organizer is Blocked; new submissions are prevented."
              : "This organizer is New. You can recommend Trusted status to an admin when approving."}
        </p>
      </div>

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
                <span className="break-words text-sm text-slate-900">{String(value)}</span>
              </div>
            ))}
        </div>
      </div>

      <DuplicateReviewCard submitted={payload} review={duplicateReview} area="moderator" mergeAction={isPending ? mergeWithId : undefined} approveDistinctAction={isPending ? approveWithId : undefined} />

      {isPending && <SubmissionEditForm payload={payload} action={editWithId} />}

      {isPending ? (
        <div className="space-y-4">
          {!hasLikelyDuplicate && <form action={approveWithId} className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="recommendTrust"
                className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                Recommend that admin mark this organizer Trusted for future auto-publishing.
              </span>
            </label>

            <textarea
              name="notes"
              rows={3}
              placeholder="Optional note for admin or review history..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />

            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              Approve and Publish Show
            </button>
          </form>}

          <form action={rejectWithId} className="space-y-3">
            <textarea
              name="notes"
              rows={3}
              placeholder="Reason for rejection..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              Reject Submission
            </button>
          </form>
          <form action={correctionsWithId} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <textarea name="notes" required rows={3} placeholder="What should the submitter correct?" className="w-full resize-none rounded-lg border border-amber-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <button type="submit" className="w-full rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700">Request Corrections</button>
          </form>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">
            This submission has already been <strong>{submission.status.toLowerCase()}</strong>.
            {submission.notes && <> Note: {submission.notes}</>}
          </p>
        </div>
      )}
    </div>
  );
}
