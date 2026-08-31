import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { isFixtureMode } from "@/lib/data-mode";
import { getCityCoords } from "@/lib/city-coords";
import { resolveManagedFlyerImageUrl } from "@/lib/flyers";
import {
  approveFixtureSubmission,
  createFixtureSubmission,
  getFixtureSubmissionById,
  getFixtureSubmissions,
  rejectFixtureSubmission,
  updateFixtureSubmissionPayload,
} from "@/lib/fixture-store";
import { slugify } from "@/lib/utils";
import { normalizeExternalUrl } from "@/lib/url";
import type { UserRole } from "@csn/db";

const reviewerInclude = {
  reviewer: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  organizer: {
    select: {
      id: true,
      name: true,
      email: true,
      moderationStatus: true,
    },
  },
} as const;

export type OrganizerModerationStatus = "NEW" | "TRUSTED" | "BLOCKED";

export class DuplicateSubmissionError extends Error {
  constructor(public readonly duplicateId: string) {
    super("A matching show or pending submission already exists.");
    this.name = "DuplicateSubmissionError";
  }
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readConsentedPublicEmail(payload: Record<string, unknown>) {
  const email = readString(payload, "publicPromoterEmail")?.toLowerCase() ?? null;
  if (!email || payload.publicPromoterEmailConsent !== true) {
    return null;
  }

  return email;
}

function readStringArray(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeDedupePart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function buildShowDedupeKey(payload: Record<string, unknown>) {
  const title = readString(payload, "showName");
  const startDate = readString(payload, "startDate");
  const city = readString(payload, "city");
  const state = readString(payload, "state");

  if (!title || !startDate || !city || !state) {
    return null;
  }

  return [
    normalizeDedupePart(title),
    startDate,
    normalizeDedupePart(city),
    state.trim().toUpperCase(),
  ].join("|");
}

async function findDuplicateForPayload(
  payload: Record<string, unknown>,
  options?: { excludeSubmissionId?: string; includePending?: boolean }
) {
  const dedupeKey = buildShowDedupeKey(payload);
  if (!dedupeKey || isFixtureMode()) {
    return null;
  }

  const storedMatch = await db.show.findUnique({
    where: { dedupeKey },
    select: { id: true, title: true },
  });
  if (storedMatch) {
    return { kind: "show" as const, id: storedMatch.id, title: storedMatch.title };
  }

  const startDateValue = readString(payload, "startDate");
  const state = readString(payload, "state")?.toUpperCase();
  if (startDateValue && state) {
    const dayStart = new Date(`${startDateValue}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const candidates = await db.show.findMany({
      where: {
        state,
        startDate: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true, title: true, city: true, state: true, startDate: true },
    });

    const legacyMatch = candidates.find(
      (show) =>
        buildShowDedupeKey({
          showName: show.title,
          startDate: show.startDate.toISOString().slice(0, 10),
          city: show.city,
          state: show.state,
        }) === dedupeKey
    );
    if (legacyMatch) {
      return { kind: "show" as const, id: legacyMatch.id, title: legacyMatch.title };
    }
  }

  if (options?.includePending === false) {
    return null;
  }

  const pendingMatch = await db.showSubmission.findFirst({
    where: {
      status: "PENDING",
      dedupeKey,
      ...(options?.excludeSubmissionId
        ? { id: { not: options.excludeSubmissionId } }
        : {}),
    },
    select: { id: true, payloadJson: true },
  });
  if (pendingMatch) {
    const pendingPayload = pendingMatch.payloadJson as Record<string, unknown>;
    return {
      kind: "submission" as const,
      id: pendingMatch.id,
      title: readString(pendingPayload, "showName") ?? "Pending show",
    };
  }

  const legacyPending = await db.showSubmission.findMany({
    where: {
      status: "PENDING",
      dedupeKey: null,
      ...(options?.excludeSubmissionId
        ? { id: { not: options.excludeSubmissionId } }
        : {}),
    },
    select: { id: true, payloadJson: true },
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  const legacyPendingMatch = legacyPending.find(
    (submission) =>
      buildShowDedupeKey(submission.payloadJson as Record<string, unknown>) === dedupeKey
  );

  return legacyPendingMatch
    ? {
        kind: "submission" as const,
        id: legacyPendingMatch.id,
        title:
          readString(legacyPendingMatch.payloadJson as Record<string, unknown>, "showName") ??
          "Pending show",
      }
    : null;
}

async function resolveOrganizerForSubmission(input: {
  submitterName: string;
  submitterEmail: string;
  payloadJson: Record<string, unknown>;
}) {
  const organizerId = readString(input.payloadJson, "organizerId");
  if (organizerId) {
    const organizer = await db.organizer.findUnique({ where: { id: organizerId } });
    if (organizer) return organizer;
  }

  const email = (
    readString(input.payloadJson, "organizerEmail") ?? input.submitterEmail
  ).toLowerCase();
  const existing = await db.organizer.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return db.organizer.create({
    data: {
      name: readString(input.payloadJson, "organizerName") ?? input.submitterName,
      email,
      publicEmail: readConsentedPublicEmail(input.payloadJson),
      publicEmailConsentAt: readConsentedPublicEmail(input.payloadJson) ? new Date() : null,
      websiteUrl: normalizeExternalUrl(readString(input.payloadJson, "websiteUrl")),
      facebookUrl: normalizeExternalUrl(readString(input.payloadJson, "facebookUrl")),
      moderationStatus: "NEW",
    },
  });
}

function readDailySchedule(payload: Record<string, unknown>) {
  const value = payload.dailySchedule;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const date = typeof row.date === "string" ? row.date.trim() : "";
      const startTimeLabel =
        typeof row.startTimeLabel === "string" ? row.startTimeLabel.trim() : "";
      const endTimeLabel = typeof row.endTimeLabel === "string" ? row.endTimeLabel.trim() : "";

      if (!date || !startTimeLabel || !endTimeLabel) {
        return null;
      }

      return { date, startTimeLabel, endTimeLabel };
    })
    .filter((row): row is { date: string; startTimeLabel: string; endTimeLabel: string } =>
      Boolean(row)
    );
}

function mergeDescriptionWithDailySchedule(payload: Record<string, unknown>) {
  const baseDescription = readString(payload, "description");
  const sameTimesEachDay = payload.sameTimesEachDay !== false;
  const dailySchedule = readDailySchedule(payload);

  if (sameTimesEachDay || dailySchedule.length === 0) {
    return baseDescription;
  }

  const scheduleSummary = dailySchedule
    .map((entry) => `${entry.date}: ${entry.startTimeLabel} - ${entry.endTimeLabel}`)
    .join(" | ");
  const scheduleLine = `Daily schedule: ${scheduleSummary}`;

  if (!baseDescription) {
    return scheduleLine;
  }

  if (baseDescription.includes(scheduleLine)) {
    return baseDescription;
  }

  return `${baseDescription}\n\n${scheduleLine}`;
}

function getApprovalLookup(payload: Record<string, unknown>) {
  const organizerId = readString(payload, "organizerId");
  const city = readString(payload, "city");
  const state = readString(payload, "state");

  if (!organizerId || !city || !state) {
    return null;
  }

  return {
    organizerId,
    city,
    state,
  };
}

export async function getOrganizerApprovalForPayload(payload: Record<string, unknown>) {
  const lookup = getApprovalLookup(payload);
  if (!lookup || isFixtureMode()) {
    return null;
  }

  return db.organizerApproval.findUnique({
    where: {
      organizerId_city_state: {
        organizerId: lookup.organizerId,
        city: lookup.city,
        state: lookup.state,
      },
    },
  });
}

async function bumpOrganizerApprovalCount(payload: Record<string, unknown>) {
  const lookup = getApprovalLookup(payload);
  if (!lookup) {
    return;
  }

  const approval = await db.organizerApproval.findUnique({
    where: {
      organizerId_city_state: {
        organizerId: lookup.organizerId,
        city: lookup.city,
        state: lookup.state,
      },
    },
  });

  if (!approval?.autoApprove) {
    return;
  }

  await db.organizerApproval.update({
    where: { id: approval.id },
    data: { approvedShowCount: { increment: 1 } },
  });
}

export async function createApprovedShowFromPayload(payload: Record<string, unknown>) {
  const organizerName = readString(payload, "organizerName");
  const organizerIdFromPayload = readString(payload, "organizerId");
  const venueName = readString(payload, "venueName");
  const venueAddress = readString(payload, "venueAddress");
  const city = readString(payload, "city") ?? "";
  const state = readString(payload, "state") ?? "";

  let organizerId: string | null = null;
  let venueId: string | null = null;

  if (organizerIdFromPayload) {
    const organizer = await db.organizer.findUnique({
      where: { id: organizerIdFromPayload },
    });
    organizerId = organizer?.id ?? null;
  }

  if (!organizerId && organizerName) {
    const existingOrganizer = await db.organizer.findFirst({
      where: { name: organizerName },
    });

    const organizer =
      existingOrganizer ??
      (await db.organizer.create({
        data: {
          name: organizerName,
          email: readString(payload, "organizerEmail"),
          publicEmail: readConsentedPublicEmail(payload),
          publicEmailConsentAt: readConsentedPublicEmail(payload) ? new Date() : null,
          websiteUrl: normalizeExternalUrl(readString(payload, "websiteUrl")),
          facebookUrl: normalizeExternalUrl(readString(payload, "facebookUrl")),
        },
      }));

    const consentedPublicEmail = readConsentedPublicEmail(payload);
    if (existingOrganizer && consentedPublicEmail) {
      await db.organizer.update({
        where: { id: existingOrganizer.id },
        data: {
          publicEmail: consentedPublicEmail,
          publicEmailConsentAt: new Date(),
        },
      });
    }

    organizerId = organizer.id;
  }

  if (venueName && venueAddress) {
    const coords = getCityCoords(city, state);
    const venue = await db.venue.upsert({
      where: { name_city_state: { name: venueName, city, state } },
      create: {
        name: venueName,
        address1: venueAddress,
        city,
        state,
        parkingInfo: readString(payload, "parkingInfo"),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      },
      update: {},
    });

    venueId = venue.id;
  }

  const baseSlug = slugify(
    `${readString(payload, "showName") ?? "show"}-${city}-${state}`
  );

  let slug = baseSlug;
  let suffix = 2;

  while (await db.show.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const flyerImageUrl = await resolveManagedFlyerImageUrl(
    readString(payload, "showName") ?? "Untitled Show",
    readString(payload, "flyerImageUrl")
  );

  return db.show.create({
    data: {
      title: readString(payload, "showName") ?? "Untitled Show",
      slug,
      dedupeKey: buildShowDedupeKey(payload),
      city,
      state,
      startDate: new Date(
        readString(payload, "startDate") ?? new Date().toISOString()
      ),
      endDate: new Date(
        readString(payload, "endDate") ??
          readString(payload, "startDate") ??
          new Date().toISOString()
      ),
      startTimeLabel: readString(payload, "startTimeLabel"),
      endTimeLabel: readString(payload, "endTimeLabel"),
      categories: readStringArray(payload, "categories"),
      description: mergeDescriptionWithDailySchedule(payload),
      tableCount: Number.parseInt(readString(payload, "tableCount") ?? "", 10) || null,
      vendorDetails: readString(payload, "vendorDetails"),
      flyerImageUrl,
      websiteUrl: normalizeExternalUrl(readString(payload, "websiteUrl")),
      facebookUrl: normalizeExternalUrl(readString(payload, "facebookUrl")),
      isFree: payload.isFree === true,
      admissionPrice: readString(payload, "admissionPrice"),
      admissionNotes: readString(payload, "admissionNotes"),
      parkingInfo: readString(payload, "parkingInfo"),
      status: "APPROVED",
      sourceType: "SUBMITTED",
      lastVerifiedAt: new Date(),
      expiresAt: new Date(
        new Date(
          readString(payload, "endDate") ?? new Date().toISOString()
        ).getTime() +
          24 * 60 * 60 * 1000
      ),
      organizerId,
      venueId,
    },
  });
}

export async function createShowSubmission(input: {
  submitterName: string;
  submitterEmail: string;
  payloadJson: Record<string, unknown>;
  organizerId?: string | null;
  dedupeKey?: string | null;
}) {
  if (isFixtureMode()) {
    return createFixtureSubmission(input);
  }

  return db.showSubmission.create({
    data: {
      submitterName: input.submitterName,
      submitterEmail: input.submitterEmail,
      payloadJson: input.payloadJson as object,
      organizerId: input.organizerId ?? null,
      dedupeKey: input.dedupeKey ?? buildShowDedupeKey(input.payloadJson),
      status: "PENDING",
    },
  });
}

export async function submitShowForModeration(input: {
  submitterName: string;
  submitterEmail: string;
  payloadJson: Record<string, unknown>;
}) {
  if (isFixtureMode()) {
    const submission = await createShowSubmission(input);
    return { status: "PENDING" as const, submission };
  }

  const duplicate = await findDuplicateForPayload(input.payloadJson, { includePending: true });
  if (duplicate) {
    return { status: "DUPLICATE" as const, duplicate };
  }

  const organizer = await resolveOrganizerForSubmission(input);
  if (organizer.moderationStatus === "BLOCKED") {
    return { status: "BLOCKED" as const, organizerId: organizer.id };
  }
  const consentedPublicEmail = readConsentedPublicEmail(input.payloadJson);
  if (consentedPublicEmail) {
    await db.organizer.update({
      where: { id: organizer.id },
      data: {
        publicEmail: consentedPublicEmail,
        publicEmailConsentAt: new Date(),
      },
    });
  }
  const payloadJson = {
    ...input.payloadJson,
    organizerId: organizer.id,
    organizerName: readString(input.payloadJson, "organizerName") ?? organizer.name,
    organizerEmail: readString(input.payloadJson, "organizerEmail") ?? organizer.email,
  };
  const submission = await createShowSubmission({
    ...input,
    payloadJson,
    organizerId: organizer.id,
    dedupeKey: buildShowDedupeKey(payloadJson),
  });

  if (organizer.moderationStatus !== "TRUSTED") {
    return { status: "PENDING" as const, submission };
  }

  const show = await approveShowSubmission(submission.id, {
    notes: "Auto-published for a trusted organizer.",
  });
  return { status: "APPROVED" as const, submission, show };
}

export async function getAllSubmissions() {
  if (isFixtureMode()) {
    return getFixtureSubmissions();
  }

  return db.showSubmission.findMany({
    include: reviewerInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPendingSubmissions() {
  if (isFixtureMode()) {
    return (await getFixtureSubmissions()).filter(
      (submission) => submission.status === "PENDING"
    );
  }

  return db.showSubmission.findMany({
    include: reviewerInclude,
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
}

export async function getModeratorVisibleSubmissions(userId: string) {
  if (isFixtureMode()) {
    return (await getFixtureSubmissions()).filter(
      (submission) => submission.status === "PENDING" || submission.reviewerId === userId
    );
  }

  return db.showSubmission.findMany({
    include: reviewerInclude,
    where: {
      OR: [{ status: "PENDING" }, { reviewerId: userId }],
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getSubmissionById(id: string) {
  if (isFixtureMode()) {
    return getFixtureSubmissionById(id);
  }

  return db.showSubmission.findUnique({
    where: { id },
    include: reviewerInclude,
  });
}

export async function getModeratorVisibleSubmissionById(id: string, userId: string) {
  const submission = await getSubmissionById(id);
  if (!submission) {
    return null;
  }

  if (submission.status === "PENDING" || submission.reviewerId === userId) {
    return submission;
  }

  return null;
}

export async function approveShowSubmission(
  submissionId: string,
  options?: {
    reviewerId?: string | null;
    reviewerRole?: UserRole | null;
    notes?: string | null;
  }
) {
  if (isFixtureMode()) {
    return approveFixtureSubmission(submissionId);
  }

  const actorRole = options?.reviewerRole ?? null;
  if (actorRole && actorRole !== "ADMIN" && actorRole !== "MODERATOR") {
    throw new Error("Only admin or moderator reviewers can approve submissions.");
  }

  const submission = await db.showSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) return null;
  if (submission.status !== "PENDING") {
    return submission.reviewedShowId
      ? db.show.findUnique({ where: { id: submission.reviewedShowId } })
      : null;
  }

  const payload = submission.payloadJson as Record<string, unknown>;
  const duplicate = await findDuplicateForPayload(payload, { includePending: false });
  if (duplicate) {
    throw new DuplicateSubmissionError(duplicate.id);
  }
  const show = await createApprovedShowFromPayload(payload);
  await bumpOrganizerApprovalCount(payload);

  await db.showSubmission.update({
    where: { id: submissionId },
    data: {
      status: "APPROVED",
      reviewedShowId: show.id,
      reviewerId: options?.reviewerId ?? null,
      reviewerRole: options?.reviewerRole ?? null,
      notes: options?.notes ?? null,
    },
  });

  await writeAuditLog({
    actorId: options?.reviewerId ?? null,
    actorRole,
    action: "submission.approved",
    targetType: "ShowSubmission",
    targetId: submissionId,
    details: {
      reviewedShowId: show.id,
      submitterEmail: submission.submitterEmail,
    },
  });

  return show;
}

export async function updatePendingSubmissionPayload(
  submissionId: string,
  updates: Record<string, unknown>,
  actor: {
    reviewerId?: string | null;
    reviewerRole?: UserRole | null;
  }
) {
  if (actor.reviewerRole !== "ADMIN" && actor.reviewerRole !== "MODERATOR") {
    throw new Error("Only admin or moderator reviewers can edit submissions.");
  }

  const existing = await getSubmissionById(submissionId);
  if (!existing || existing.status !== "PENDING") {
    return null;
  }

  const payloadJson = {
    ...(existing.payloadJson as Record<string, unknown>),
    ...updates,
  };
  const previousPayload = existing.payloadJson as Record<string, unknown>;
  if (
    updates.startDate !== previousPayload.startDate ||
    updates.endDate !== previousPayload.endDate
  ) {
    payloadJson.sameTimesEachDay = true;
    payloadJson.dailySchedule = null;
  }

  if (isFixtureMode()) {
    return updateFixtureSubmissionPayload(submissionId, payloadJson);
  }

  const duplicate = await findDuplicateForPayload(payloadJson, {
    excludeSubmissionId: submissionId,
    includePending: true,
  });
  if (duplicate) {
    throw new DuplicateSubmissionError(duplicate.id);
  }

  const submission = await db.showSubmission.update({
    where: { id: submissionId },
    data: {
      payloadJson: payloadJson as object,
      dedupeKey: buildShowDedupeKey(payloadJson),
    },
  });

  await writeAuditLog({
    actorId: actor.reviewerId ?? null,
    actorRole: actor.reviewerRole,
    action: "submission.edited",
    targetType: "ShowSubmission",
    targetId: submissionId,
    details: { updatedFields: Object.keys(updates) },
  });

  return submission;
}

export async function setOrganizerModerationStatus(
  organizerId: string,
  moderationStatus: OrganizerModerationStatus,
  actor: {
    actorId?: string | null;
    actorRole?: UserRole | null;
  }
) {
  if (actor.actorRole !== "ADMIN") {
    throw new Error("Only admins can update organizer moderation status.");
  }

  const organizer = await db.$transaction(async (transaction) => {
    const updated = await transaction.organizer.update({
      where: { id: organizerId },
      data: { moderationStatus },
    });

    if (moderationStatus !== "TRUSTED") {
      await transaction.organizerApproval.updateMany({
        where: { organizerId },
        data: { autoApprove: false },
      });
    }

    return updated;
  });

  await writeAuditLog({
    actorId: actor.actorId ?? null,
    actorRole: actor.actorRole,
    action: `promoter.moderation_${moderationStatus.toLowerCase()}`,
    targetType: "Organizer",
    targetId: organizerId,
  });

  return organizer;
}

export async function setOrganizerAutoApprovalForPayload(
  payload: Record<string, unknown>,
  enabled: boolean,
  reviewEvery?: number,
  actor?: {
    actorId?: string | null;
    actorRole?: UserRole | null;
  }
) {
  if (actor?.actorRole !== "ADMIN") {
    throw new Error("Only admins can update promoter auto-approval.");
  }

  const lookup = getApprovalLookup(payload);
  if (!lookup) {
    return null;
  }

  const normalizedReviewEvery =
    typeof reviewEvery === "number" ? Math.max(1, Math.min(10, reviewEvery)) : 4;

  const approval = await db.organizerApproval.upsert({
    where: {
      organizerId_city_state: {
        organizerId: lookup.organizerId,
        city: lookup.city,
        state: lookup.state,
      },
    },
    create: {
      organizerId: lookup.organizerId,
      city: lookup.city,
      state: lookup.state,
      autoApprove: enabled,
      reviewEvery: normalizedReviewEvery,
    },
    update: {
      autoApprove: enabled,
      reviewEvery: normalizedReviewEvery,
    },
  });

  await db.organizer.update({
    where: { id: lookup.organizerId },
    data: { moderationStatus: enabled ? "TRUSTED" : "NEW" },
  });

  await writeAuditLog({
    actorId: actor.actorId ?? null,
    actorRole: actor.actorRole,
    action: enabled ? "promoter.trust_enabled" : "promoter.trust_disabled",
    targetType: "OrganizerApproval",
    targetId: approval.id,
    details: {
      organizerId: lookup.organizerId,
      city: lookup.city,
      state: lookup.state,
      reviewEvery: normalizedReviewEvery,
    },
  });

  return approval;
}

export async function rejectShowSubmission(
  submissionId: string,
  notes: string | null,
  options?: {
    reviewerId?: string | null;
    reviewerRole?: UserRole | null;
  }
) {
  if (isFixtureMode()) {
    return rejectFixtureSubmission(submissionId, notes);
  }

  const actorRole = options?.reviewerRole ?? null;
  if (actorRole && actorRole !== "ADMIN" && actorRole !== "MODERATOR") {
    throw new Error("Only admin or moderator reviewers can reject submissions.");
  }

  const existing = await db.showSubmission.findUnique({ where: { id: submissionId } });
  if (!existing) return null;
  if (existing.status !== "PENDING") return existing;

  const submission = await db.showSubmission.update({
    where: { id: submissionId },
    data: {
      status: "REJECTED",
      notes,
      reviewerId: options?.reviewerId ?? null,
      reviewerRole: options?.reviewerRole ?? null,
    },
  });

  await writeAuditLog({
    actorId: options?.reviewerId ?? null,
    actorRole,
    action: "submission.rejected",
    targetType: "ShowSubmission",
    targetId: submissionId,
    details: {
      notes,
      submitterEmail: submission.submitterEmail,
    },
  });

  return submission;
}
