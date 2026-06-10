import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { updateFixtureShow } from "@/lib/fixture-store";
import {
  assignShowToPromoterByEmail,
  clearShowPromoterAssignment,
  getAdminShowById,
  updateAdminShowDetails,
} from "@/lib/shows";
import { formatShowDate } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assign?: string; edit?: string }>;
};

export const dynamic = "force-dynamic";

function readReviewEvery(formData: FormData) {
  const reviewEveryValue = formData.get("reviewEvery");
  return Math.max(
    1,
    Math.min(
      10,
      typeof reviewEveryValue === "string"
        ? Number.parseInt(reviewEveryValue, 10) || 4
        : 4
    )
  );
}

async function approveShow(showId: string) {
  "use server";
  const session = await requireAdminSession(`/admin/shows/${showId}`);

  if (isFixtureMode()) {
    await updateFixtureShow(showId, {
      status: "APPROVED",
      lastVerifiedAt: new Date(),
    });
  } else {
    await db.show.update({
      where: { id: showId },
      data: { status: "APPROVED", lastVerifiedAt: new Date() },
    });
  }

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "show.approved",
    targetType: "Show",
    targetId: showId,
  });

  redirect("/admin/shows");
}

async function rejectShow(showId: string) {
  "use server";
  const session = await requireAdminSession(`/admin/shows/${showId}`);

  if (isFixtureMode()) {
    await updateFixtureShow(showId, {
      status: "REJECTED",
    });
  } else {
    await db.show.update({
      where: { id: showId },
      data: { status: "REJECTED" },
    });
  }

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "show.rejected",
    targetType: "Show",
    targetId: showId,
  });

  redirect("/admin/shows");
}

async function markVerified(showId: string) {
  "use server";
  const session = await requireAdminSession(`/admin/shows/${showId}`);

  if (isFixtureMode()) {
    await updateFixtureShow(showId, {
      lastVerifiedAt: new Date(),
    });
  } else {
    await db.show.update({
      where: { id: showId },
      data: { lastVerifiedAt: new Date() },
    });
  }

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "show.marked_verified",
    targetType: "Show",
    targetId: showId,
  });

  redirect(`/admin/shows/${showId}`);
}

async function trustPromoterForCity(showId: string, formData: FormData) {
  "use server";
  const session = await requireAdminSession(`/admin/shows/${showId}`);

  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      city: true,
      state: true,
      organizerId: true,
    },
  });

  if (!show?.organizerId) {
    redirect(`/admin/shows/${showId}`);
  }

  const reviewEvery = readReviewEvery(formData);

  const approval = await db.organizerApproval.upsert({
    where: {
      organizerId_city_state: {
        organizerId: show.organizerId,
        city: show.city,
        state: show.state,
      },
    },
    create: {
      organizerId: show.organizerId,
      city: show.city,
      state: show.state,
      autoApprove: true,
      reviewEvery,
    },
    update: {
      autoApprove: true,
      reviewEvery,
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "promoter.trust_enabled",
    targetType: "OrganizerApproval",
    targetId: approval.id,
    details: {
      organizerId: show.organizerId,
      city: show.city,
      state: show.state,
      reviewEvery,
      showId,
    },
  });

  redirect(`/admin/shows/${showId}`);
}

async function untrustPromoterForCity(showId: string) {
  "use server";
  const session = await requireAdminSession(`/admin/shows/${showId}`);

  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      city: true,
      state: true,
      organizerId: true,
    },
  });

  if (!show?.organizerId) {
    redirect(`/admin/shows/${showId}`);
  }

  await db.organizerApproval.deleteMany({
    where: {
      organizerId: show.organizerId,
      city: show.city,
      state: show.state,
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    actorRole: "ADMIN",
    action: "promoter.trust_removed",
    targetType: "OrganizerApproval",
    details: {
      organizerId: show.organizerId,
      city: show.city,
      state: show.state,
      showId,
    },
  });

  redirect(`/admin/shows/${showId}`);
}

async function assignPromoter(showId: string, formData: FormData) {
  "use server";
  const session = await requireAdminSession(`/admin/shows/${showId}`);

  const emailValue = formData.get("promoterEmail");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const result = await assignShowToPromoterByEmail(showId, email, {
    actorId: session.user.id,
    actorRole: "ADMIN",
  });

  const status =
    result.success ? "assigned" : result.reason === "not-found" ? "missing" : "invalid";
  redirect(`/admin/shows/${showId}?assign=${status}`);
}

async function clearPromoter(showId: string) {
  "use server";
  const session = await requireAdminSession(`/admin/shows/${showId}`);
  await clearShowPromoterAssignment(showId, {
    actorId: session.user.id,
    actorRole: "ADMIN",
  });
  redirect(`/admin/shows/${showId}?assign=cleared`);
}

function readOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function readRequiredString(formData: FormData, key: string, maxLength: number) {
  return readOptionalString(formData, key, maxLength) ?? "";
}

async function saveShowEdits(showId: string, formData: FormData) {
  "use server";
  const session = await requireAdminSession(`/admin/shows/${showId}`);

  const result = await updateAdminShowDetails(
    showId,
    {
      title: readRequiredString(formData, "title", 200),
      startDate: readRequiredString(formData, "startDate", 20),
      endDate: readRequiredString(formData, "endDate", 20),
      startTimeLabel: readOptionalString(formData, "startTimeLabel", 40),
      endTimeLabel: readOptionalString(formData, "endTimeLabel", 40),
      city: readRequiredString(formData, "city", 120),
      state: readRequiredString(formData, "state", 2),
      isFree: formData.get("isFree") === "on",
      admissionPrice: readOptionalString(formData, "admissionPrice", 120),
      admissionNotes: readOptionalString(formData, "admissionNotes", 500),
      tableCount: readOptionalString(formData, "tableCount", 20),
      estimatedAttendance: readOptionalString(formData, "estimatedAttendance", 20),
      categories: readOptionalString(formData, "categories", 300),
      description: readOptionalString(formData, "description", 5000),
      websiteUrl: readOptionalString(formData, "websiteUrl", 2048),
      facebookUrl: readOptionalString(formData, "facebookUrl", 2048),
      ticketUrl: readOptionalString(formData, "ticketUrl", 2048),
      vendorDetails: readOptionalString(formData, "vendorDetails", 2000),
      parkingInfo: readOptionalString(formData, "parkingInfo", 1000),
      loadInInfo: readOptionalString(formData, "loadInInfo", 1000),
      venueNotes: readOptionalString(formData, "venueNotes", 1000),
      flyerImageUrl: readOptionalString(formData, "flyerImageUrl", 2048),
      venueName: readOptionalString(formData, "venueName", 200),
      venueAddress1: readOptionalString(formData, "venueAddress1", 200),
      venueAddress2: readOptionalString(formData, "venueAddress2", 200),
      venuePostalCode: readOptionalString(formData, "venuePostalCode", 20),
    },
    {
      actorId: session.user.id,
      actorRole: "ADMIN",
    }
  );

  const status =
    result.success
      ? "saved"
      : result.reason === "not-found"
        ? "missing"
        : "invalid";
  redirect(`/admin/shows/${showId}?edit=${status}`);
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function AdminShowDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdminSession(`/admin/shows/${id}`);
  const show = await getAdminShowById(id);

  if (!show) notFound();

  const approveShowWithId = approveShow.bind(null, show.id);
  const rejectShowWithId = rejectShow.bind(null, show.id);
  const markVerifiedWithId = markVerified.bind(null, show.id);
  const trustPromoterWithId = trustPromoterForCity.bind(null, show.id);
  const untrustPromoterWithId = untrustPromoterForCity.bind(null, show.id);
  const assignPromoterWithId = assignPromoter.bind(null, show.id);
  const clearPromoterWithId = clearPromoter.bind(null, show.id);
  const saveShowEditsWithId = saveShowEdits.bind(null, show.id);
  const isMutable = !isFixtureMode() || show.id.startsWith("local-show-");
  const cityApproval =
    !isFixtureMode() && show.organizerId
      ? await db.organizerApproval.findUnique({
          where: {
            organizerId_city_state: {
              organizerId: show.organizerId,
              city: show.city,
              state: show.state,
            },
          },
        })
      : null;

  return (
    <div className="max-w-4xl p-6 lg:p-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/admin/shows" className="text-sm text-brand-600 hover:underline">
          ← Back to Shows
        </Link>
        <Link
          href={`/shows/${show.slug}`}
          target="_blank"
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          View live ↗
        </Link>
      </div>

      {sp.assign && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {sp.assign === "assigned" && "Promoter account assigned to this show."}
          {sp.assign === "cleared" && "Promoter assignment removed from this show."}
          {sp.assign === "missing" && "No promoter account matched that email address."}
          {sp.assign === "invalid" && "Enter a promoter account email to assign this show."}
        </div>
      )}

      {sp.edit && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {sp.edit === "saved" && "Listing changes saved."}
          {sp.edit === "invalid" && "Check the listing fields and try again."}
          {sp.edit === "missing" && "That show could not be found."}
        </div>
      )}

      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{show.title}</h1>
          <p className="mt-1 text-slate-500">
            {show.city}, {show.state} · {formatShowDate(show.startDate, show.endDate)}
          </p>
        </div>
        <StatusBadge status={show.status} />
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <Link
            href={`/admin/shows/${show.id}/floorplan`}
            className="rounded-lg border border-brand-200 bg-brand-50 px-5 py-2 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-100"
          >
            Open Floorplan
          </Link>
        </div>
        {isMutable ? (
          <div className="flex flex-wrap gap-3">
            {show.status !== "APPROVED" && (
              <form action={approveShowWithId}>
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                >
                  Approve
                </button>
              </form>
            )}
            {show.status !== "REJECTED" && (
              <form action={rejectShowWithId}>
                <button
                  type="submit"
                  className="rounded-lg border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  Reject
                </button>
              </form>
            )}
            <form action={markVerifiedWithId}>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Mark Verified Today
              </button>
            </form>
            {show.organizerId && (
              cityApproval ? (
                <>
                  <form
                    action={trustPromoterWithId}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <label
                      htmlFor="reviewEvery"
                      className="text-xs font-medium text-slate-500"
                    >
                      Spot check every
                    </label>
                    <input
                      id="reviewEvery"
                      name="reviewEvery"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={cityApproval.reviewEvery}
                      className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <span className="text-xs text-slate-500">shows</span>
                    <button
                      type="submit"
                      className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-50"
                    >
                      Update Trust
                    </button>
                  </form>
                  <form action={untrustPromoterWithId}>
                    <button
                      type="submit"
                      className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
                    >
                      Remove City Trust
                    </button>
                  </form>
                </>
              ) : (
                <form
                  action={trustPromoterWithId}
                  className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2"
                >
                  <label
                    htmlFor="reviewEvery"
                    className="text-xs font-medium text-brand-800"
                  >
                    Spot check every
                  </label>
                  <input
                    id="reviewEvery"
                    name="reviewEvery"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={4}
                    className="w-16 rounded-md border border-brand-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <span className="text-xs text-brand-800">shows</span>
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                  >
                    Trust Promoter For This City
                  </button>
                </form>
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Built-in fixture listings are read-only. Submit a new show to test full
            approval and publish flow.
          </p>
        )}

        <p className="mt-3 text-xs text-slate-400">
          Last verified:{" "}
          {show.lastVerifiedAt ? new Date(show.lastVerifiedAt).toLocaleDateString() : "Never"}
        </p>
      </div>

      <div className="space-y-6">
        <Section title="Edit Listing">
          {isMutable ? (
            <form action={saveShowEditsWithId} className="space-y-5 px-5 py-4">
              <div className="grid gap-5 sm:grid-cols-2">
                <InputField label="Title" name="title" defaultValue={show.title} required />
                <InputField
                  label="Categories"
                  name="categories"
                  defaultValue={show.categories.join(", ")}
                  placeholder="Sports Cards, Pokemon"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <InputField
                  label="Start Date"
                  name="startDate"
                  type="date"
                  defaultValue={formatDateInput(show.startDate)}
                  required
                />
                <InputField
                  label="End Date"
                  name="endDate"
                  type="date"
                  defaultValue={formatDateInput(show.endDate)}
                  required
                />
                <InputField
                  label="Start Time Label"
                  name="startTimeLabel"
                  defaultValue={show.startTimeLabel ?? ""}
                  placeholder="9:00 AM"
                />
                <InputField
                  label="End Time Label"
                  name="endTimeLabel"
                  defaultValue={show.endTimeLabel ?? ""}
                  placeholder="4:00 PM"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <InputField label="City" name="city" defaultValue={show.city} required />
                <InputField
                  label="State"
                  name="state"
                  defaultValue={show.state}
                  required
                  maxLength={2}
                />
                <InputField
                  label="Table Count"
                  name="tableCount"
                  type="number"
                  defaultValue={show.tableCount?.toString() ?? ""}
                />
                <InputField
                  label="Estimated Attendance"
                  name="estimatedAttendance"
                  type="number"
                  defaultValue={show.estimatedAttendance?.toString() ?? ""}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <InputField
                  label="Admission Price"
                  name="admissionPrice"
                  defaultValue={show.admissionPrice ?? ""}
                />
                <InputField
                  label="Admission Notes"
                  name="admissionNotes"
                  defaultValue={show.admissionNotes ?? ""}
                />
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="isFree"
                  defaultChecked={show.isFree}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Free admission
              </label>

              <TextAreaField
                label="Description"
                name="description"
                defaultValue={show.description ?? ""}
                rows={4}
              />
              <TextAreaField
                label="Vendor Details"
                name="vendorDetails"
                defaultValue={show.vendorDetails ?? ""}
                rows={3}
              />
              <TextAreaField
                label="Parking Info"
                name="parkingInfo"
                defaultValue={show.parkingInfo ?? ""}
                rows={3}
              />
              <TextAreaField
                label="Load-In Info"
                name="loadInInfo"
                defaultValue={show.loadInInfo ?? ""}
                rows={3}
              />
              <TextAreaField
                label="Venue Notes"
                name="venueNotes"
                defaultValue={show.venueNotes ?? ""}
                rows={3}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <InputField
                  label="Website URL"
                  name="websiteUrl"
                  defaultValue={show.websiteUrl ?? ""}
                />
                <InputField
                  label="Facebook URL"
                  name="facebookUrl"
                  defaultValue={show.facebookUrl ?? ""}
                />
                <InputField
                  label="Ticket URL"
                  name="ticketUrl"
                  defaultValue={show.ticketUrl ?? ""}
                />
                <InputField
                  label="Flyer Image URL"
                  name="flyerImageUrl"
                  defaultValue={show.flyerImageUrl ?? ""}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <InputField
                  label="Venue Name"
                  name="venueName"
                  defaultValue={show.venue?.name ?? ""}
                />
                <InputField
                  label="Address 1"
                  name="venueAddress1"
                  defaultValue={show.venue?.address1 ?? ""}
                />
                <InputField
                  label="Address 2"
                  name="venueAddress2"
                  defaultValue={show.venue?.address2 ?? ""}
                />
                <InputField
                  label="Postal Code"
                  name="venuePostalCode"
                  defaultValue={show.venue?.postalCode ?? ""}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Save Listing Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-500">
              Built-in fixture listings are read-only. Submit a new show to test admin edits.
            </div>
          )}
        </Section>

        <Section title="Show Details">
          <Field label="Title" value={show.title} />
          <Field label="Slug" value={show.slug} mono />
          <Field label="Status" value={show.status} />
          <Field label="Source" value={show.sourceType} />
          <Field label="Categories" value={show.categories.join(", ") || "—"} />
          <Field label="Start Date" value={show.startDate.toLocaleString()} />
          <Field label="End Date" value={show.endDate.toLocaleString()} />
          <Field
            label="Time"
            value={`${show.startTimeLabel ?? "—"} - ${show.endTimeLabel ?? "—"}`}
          />
          <Field label="Free" value={show.isFree ? "Yes" : "No"} />
          <Field label="Admission" value={show.admissionPrice ?? "—"} />
          <Field label="Table Count" value={show.tableCount?.toString() ?? "—"} />
          <Field label="Vendor Details" value={show.vendorDetails ?? "—"} />
          {show.description && <Field label="Description" value={show.description} />}
        </Section>

        <Section title="Location">
          <Field label="City" value={show.city} />
          <Field label="State" value={show.state} />
          {show.venue && (
            <>
              <Field label="Venue" value={show.venue.name} />
              <Field label="Address" value={show.venue.address1} />
              {show.venue.postalCode && (
                <Field label="Postal Code" value={show.venue.postalCode} />
              )}
            </>
          )}
          {show.parkingInfo && <Field label="Parking" value={show.parkingInfo} />}
        </Section>

        {show.organizer && (
          <Section title="Organizer">
            <Field label="Name" value={show.organizer.name} />
            {show.organizer.email && <Field label="Email" value={show.organizer.email} />}
            {show.organizer.websiteUrl && (
              <Field label="Website" value={show.organizer.websiteUrl} />
            )}
            <Field
              label="City Trust"
              value={
                cityApproval
                  ? `${show.city}, ${show.state} · ${cityApproval.approvedShowCount} approved shows · review every ${cityApproval.reviewEvery}`
                  : "Not trusted for this city"
              }
            />
            <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Promoter assignment</p>
                <p className="mt-1 text-sm text-slate-900">
                  This show is currently linked to {show.organizer.name}.
                </p>
              </div>
              <form action={clearPromoterWithId}>
                <button
                  type="submit"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  Remove assignment
                </button>
              </form>
            </div>
          </Section>
        )}

        <Section title="Assign To Promoter">
          <div className="px-5 py-4">
            <p className="text-sm text-slate-600">
              Link this show to an existing promoter account by organizer email or login email so it appears under that promoter dashboard.
            </p>
            <form action={assignPromoterWithId} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                name="promoterEmail"
                type="email"
                placeholder="promoter@example.com"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Assign promoter
              </button>
            </form>
          </div>
        </Section>

        <Section title="Links">
          <Field label="Website" value={show.websiteUrl ?? "—"} />
          <Field label="Facebook" value={show.facebookUrl ?? "—"} />
          <Field label="Tickets" value={show.ticketUrl ?? "—"} />
        </Section>

        <Section title="Meta">
          <Field label="Created" value={show.createdAt.toLocaleString()} />
          <Field label="Updated" value={show.updatedAt.toLocaleString()} />
          <Field label="Expires" value={show.expiresAt?.toLocaleString() ?? "—"} />
          <Field label="ID" value={show.id} mono />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <span className="w-32 shrink-0 pt-0.5 text-xs font-medium text-slate-400">
        {label}
      </span>
      <span className={`break-words text-sm text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function InputField({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  placeholder,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  rows,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: "border-green-100 bg-green-50 text-green-700",
    PENDING: "border-yellow-100 bg-yellow-50 text-yellow-700",
    REJECTED: "border-red-100 bg-red-50 text-red-600",
    EXPIRED: "border-slate-200 bg-slate-100 text-slate-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${
        styles[status] ?? "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}
