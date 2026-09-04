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
import { informationScore, isLikelyDuplicate, showMatchScore, type DedupeRecord } from "@/lib/show-dedupe";
import { sendSubmissionDecisionEmail } from "@/lib/email";
import { mergeMissingShowDetails, ENRICHABLE_SHOW_FIELD_LABELS } from "@/lib/show-enrichment";
import type { PublicDuplicatePreview } from "@/lib/duplicate-preview";

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
  const venueName = readString(payload, "venueName");

  if (!title || !startDate || !city || !state) {
    return null;
  }

  return [
    normalizeDedupePart(title),
    startDate,
    normalizeDedupePart(city),
    state.trim().toUpperCase(),
    venueName ? normalizeDedupePart(venueName) : "",
  ].join("|");
}

export async function findDuplicateForPayload(
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
      select: { id: true, title: true, city: true, state: true, startDate: true, description: true, websiteUrl: true, facebookUrl: true, tableCount: true, startTimeLabel: true, endTimeLabel: true, venue: { select: { name: true, address1: true } } },
    });

    const legacyMatch = candidates
      .map((show) => ({ show, score: showMatchScore(payload, {
          showName: show.title,
          startDate: show.startDate.toISOString().slice(0, 10),
          city: show.city,
          state: show.state,
          venueName: show.venue?.name,
          venueAddress: show.venue?.address1,
        }) }))
      .filter(({ score }) => score >= 72)
      .sort((a, b) => b.score - a.score)[0]?.show;
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
      ...(startDateValue && state ? { AND: [
        { payloadJson: { path: ["startDate"], equals: startDateValue } },
        { payloadJson: { path: ["state"], equals: state } },
      ] } : {}),
      ...(options?.excludeSubmissionId
        ? { id: { not: options.excludeSubmissionId } }
        : {}),
    },
    select: { id: true, payloadJson: true },
    take: 500,
    orderBy: { createdAt: "desc" },
  });
  const legacyPendingMatch = legacyPending.find((submission) =>
    isLikelyDuplicate(payload, submission.payloadJson as DedupeRecord)
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

export async function getDuplicateReview(payload: Record<string, unknown>, excludeSubmissionId?: string) {
  if (isFixtureMode()) return null;
  const claimTargetShowId = readString(payload, "claimTargetShowId");
  if (claimTargetShowId) {
    const show = await db.show.findUnique({ where: { id: claimTargetShowId }, include: { venue: true } });
    if (!show) return null;
    const record = { slug: show.slug, showName: show.title, startDate: show.startDate.toISOString().slice(0, 10), city: show.city, state: show.state, venueName: show.venue?.name, venueAddress: show.venue?.address1, description: show.description, websiteUrl: show.websiteUrl, facebookUrl: show.facebookUrl, tableCount: show.tableCount, startTimeLabel: show.startTimeLabel, endTimeLabel: show.endTimeLabel, admissionPrice: show.admissionPrice, admissionNotes: show.admissionNotes, vendorDetails: show.vendorDetails, parkingInfo: show.parkingInfo, categories: show.categories, isFree: show.isFree } satisfies Record<string, unknown>;
    const submittedInfo = informationScore(payload);
    const existingInfo = informationScore(record);
    return { kind: "show" as const, id: show.id, record, score: showMatchScore(payload, record), submittedInfo, existingInfo, recommendation: submittedInfo > existingInfo ? "submission" as const : "existing" as const };
  }
  const startDate = readString(payload, "startDate");
  const state = readString(payload, "state")?.toUpperCase();
  if (!startDate || !state) return null;
  const dayStart = new Date(`${startDate}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const [shows, submissions] = await Promise.all([
    db.show.findMany({
      where: { state, startDate: { gte: dayStart, lt: dayEnd } },
      include: { venue: true }, take: 40,
    }),
    db.showSubmission.findMany({
      where: { status: "PENDING", AND: [
        { payloadJson: { path: ["startDate"], equals: startDate } },
        { payloadJson: { path: ["state"], equals: state } },
      ], ...(excludeSubmissionId ? { id: { not: excludeSubmissionId } } : {}) },
      select: { id: true, payloadJson: true }, orderBy: { createdAt: "desc" }, take: 500,
    }),
  ]);
  const candidates = [
    ...shows.map((show) => ({ kind: "show" as const, id: show.id, record: { slug: show.slug, showName: show.title, startDate: show.startDate.toISOString().slice(0, 10), city: show.city, state: show.state, venueName: show.venue?.name, venueAddress: show.venue?.address1, description: show.description, websiteUrl: show.websiteUrl, facebookUrl: show.facebookUrl, tableCount: show.tableCount, startTimeLabel: show.startTimeLabel, endTimeLabel: show.endTimeLabel, admissionPrice: show.admissionPrice, admissionNotes: show.admissionNotes, vendorDetails: show.vendorDetails, parkingInfo: show.parkingInfo, categories: show.categories, isFree: show.isFree } })),
    ...submissions.map((submission) => ({ kind: "submission" as const, id: submission.id, record: submission.payloadJson as DedupeRecord })),
  ].map((candidate) => ({ ...candidate, score: showMatchScore(payload, candidate.record) }))
    .filter((candidate) => candidate.score >= 55)
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) return null;
  const submittedInfo = informationScore(payload);
  const existingInfo = informationScore(best.record);
  return { ...best, submittedInfo, existingInfo, recommendation: submittedInfo > existingInfo ? "submission" as const : "existing" as const };
}

export async function getPublicDuplicatePreview(
  payload: Record<string, unknown>
): Promise<PublicDuplicatePreview | null> {
  const review = await getDuplicateReview(payload);
  if (!review || review.score < 72) return null;
  const { changedFields } = mergeMissingShowDetails(review.record as Record<string, unknown>, payload);
  const date = readString(review.record as Record<string, unknown>, "startDate") ?? readString(payload, "startDate") ?? "";
  const state = readString(review.record as Record<string, unknown>, "state") ?? readString(payload, "state") ?? "";

  if (review.kind === "submission") {
    return {
      kind: "submission",
      score: review.score,
      title: "A matching submission",
      date,
      city: readString(payload, "city") ?? "",
      state,
      venueName: readString(payload, "venueName") ?? "",
      href: null,
      recommendation: review.recommendation === "submission" ? "incoming" : "existing",
      enrichableFields: changedFields.map((field) => ENRICHABLE_SHOW_FIELD_LABELS[field] ?? field),
    };
  }

  const record = review.record as Record<string, unknown>;
  return {
    kind: "show",
    score: review.score,
    title: readString(record, "showName") ?? "Existing show",
    date,
    city: readString(record, "city") ?? "",
    state,
    venueName: readString(record, "venueName") ?? "",
    href: readString(record, "slug") ? `/shows/${readString(record, "slug")}` : null,
    recommendation: review.recommendation === "submission" ? "incoming" : "existing",
    enrichableFields: changedFields.map((field) => ENRICHABLE_SHOW_FIELD_LABELS[field] ?? field),
  };
}

function shouldNotifySubmitter(payload: Record<string, unknown> | null | undefined) {
  return Boolean(payload) && !readString(payload!, "source");
}

async function notifyDecision(input: { email: string; payload?: Record<string, unknown> | null; decision: "approved" | "rejected" | "corrections"; notes?: string | null; showSlug?: string | null }) {
  if (!shouldNotifySubmitter(input.payload)) return;
  try {
    await sendSubmissionDecisionEmail(input.email, {
      decision: input.decision,
      showName: readString(input.payload!, "showName") ?? "Your card show",
      notes: input.notes ?? null,
      showUrl: input.showSlug ? `${(process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com").replace(/\/$/, "")}/shows/${input.showSlug}` : null,
    });
  } catch (error) {
    console.error("[submission email] delivery failed", error);
  }
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
  duplicatePolicy?: "reject" | "review-update";
}) {
  if (isFixtureMode()) {
    const submission = await createShowSubmission(input);
    return { status: "PENDING" as const, submission };
  }

  const duplicate = await findDuplicateForPayload(input.payloadJson, { includePending: true });
  if (duplicate && input.duplicatePolicy !== "review-update") {
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
    ...(duplicate ? {
      submissionIntent: "UPDATE_EXISTING",
      possibleDuplicateKind: duplicate.kind,
      possibleDuplicateId: duplicate.id,
      possibleDuplicateTitle: duplicate.title,
    } : {}),
  };
  const submission = await createShowSubmission({
    ...input,
    payloadJson,
    organizerId: organizer.id,
    dedupeKey: buildShowDedupeKey(payloadJson),
  });

  if (duplicate) {
    return { status: "PENDING_UPDATE" as const, submission, duplicate };
  }

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
    allowLikelyDuplicate?: boolean;
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
  const canOverrideDuplicate = options?.allowLikelyDuplicate === true && (actorRole === "ADMIN" || actorRole === "MODERATOR");
  if (duplicate && !canOverrideDuplicate) {
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

  await notifyDecision({ email: submission.submitterEmail, payload, decision: "approved", notes: options?.notes, showSlug: show.slug });

  return show;
}

export async function mergeDuplicateSubmission(
  submissionId: string,
  actor: { reviewerId: string; reviewerRole: UserRole }
) {
  if (actor.reviewerRole !== "ADMIN" && actor.reviewerRole !== "MODERATOR") {
    throw new Error("Only admin or moderator reviewers can merge submissions.");
  }
  if (isFixtureMode()) return null;

  const submission = await db.showSubmission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.status !== "PENDING") return null;
  const incoming = submission.payloadJson as Record<string, unknown>;
  const review = await getDuplicateReview(incoming, submissionId);
  if (!review || review.score < 72) {
    throw new Error("A likely duplicate is required before details can be merged.");
  }

  let changedFields: string[] = [];
  let reviewedShowId: string | null = null;
  let targetTitle = "pending submission";

  if (review.kind === "show") {
    const show = await db.show.findUnique({ where: { id: review.id }, include: { venue: true } });
    if (!show) return null;
    targetTitle = show.title;
    reviewedShowId = show.id;
    const current = {
      description: show.description,
      venueName: show.venue?.name,
      venueAddress: show.venue?.address1,
      startTimeLabel: show.startTimeLabel,
      endTimeLabel: show.endTimeLabel,
      admissionPrice: show.admissionPrice,
      admissionNotes: show.admissionNotes,
      tableCount: show.tableCount,
      websiteUrl: show.websiteUrl,
      facebookUrl: show.facebookUrl,
      vendorDetails: show.vendorDetails,
      parkingInfo: show.parkingInfo,
      categories: show.categories,
      isFree: show.isFree,
    } satisfies Record<string, unknown>;
    const merged = mergeMissingShowDetails(current, incoming);
    changedFields = merged.changedFields;

    let venueId = show.venueId;
    if (!venueId) {
      const venueName = readString(incoming, "venueName");
      const venueAddress = readString(incoming, "venueAddress");
      if (venueName && venueAddress) {
        const coords = getCityCoords(show.city, show.state);
        const venue = await db.venue.upsert({
          where: { name_city_state: { name: venueName, city: show.city, state: show.state } },
          create: { name: venueName, address1: venueAddress, city: show.city, state: show.state, latitude: coords?.lat ?? null, longitude: coords?.lng ?? null },
          update: {},
        });
        venueId = venue.id;
      }
    }

    const tableCount = Number.parseInt(String(merged.merged.tableCount ?? ""), 10);
    await db.show.update({
      where: { id: show.id },
      data: {
        description: readString(merged.merged, "description"),
        startTimeLabel: readString(merged.merged, "startTimeLabel"),
        endTimeLabel: readString(merged.merged, "endTimeLabel"),
        admissionPrice: readString(merged.merged, "admissionPrice"),
        admissionNotes: readString(merged.merged, "admissionNotes"),
        tableCount: Number.isFinite(tableCount) && tableCount > 0 ? tableCount : null,
        websiteUrl: normalizeExternalUrl(readString(merged.merged, "websiteUrl")),
        facebookUrl: normalizeExternalUrl(readString(merged.merged, "facebookUrl")),
        vendorDetails: readString(merged.merged, "vendorDetails"),
        parkingInfo: readString(merged.merged, "parkingInfo"),
        categories: Array.isArray(merged.merged.categories)
          ? merged.merged.categories.filter((value): value is string => typeof value === "string")
          : show.categories,
        isFree: merged.merged.isFree === true,
        venueId,
        lastVerifiedAt: new Date(),
      },
    });
  } else {
    const target = await db.showSubmission.findUnique({ where: { id: review.id } });
    if (!target || target.status !== "PENDING") return null;
    const targetPayload = target.payloadJson as Record<string, unknown>;
    targetTitle = readString(targetPayload, "showName") ?? targetTitle;
    const merged = mergeMissingShowDetails(targetPayload, incoming);
    changedFields = merged.changedFields;
    if (changedFields.length > 0) {
      await db.showSubmission.update({
        where: { id: target.id },
        data: { payloadJson: merged.merged as object },
      });
    }
  }

  const note = changedFields.length > 0
    ? `Merged into ${targetTitle}. Added: ${changedFields.map((field) => ENRICHABLE_SHOW_FIELD_LABELS[field] ?? field).join(", ")}.`
    : `Reviewed as a duplicate of ${targetTitle}; no missing details were available to add.`;
  await db.showSubmission.update({
    where: { id: submission.id },
    data: {
      status: review.kind === "show" ? "APPROVED" : "REJECTED",
      reviewedShowId,
      reviewerId: actor.reviewerId,
      reviewerRole: actor.reviewerRole,
      notes: note,
    },
  });
  await writeAuditLog({
    actorId: actor.reviewerId,
    actorRole: actor.reviewerRole,
    action: "submission.duplicate_merged",
    targetType: "ShowSubmission",
    targetId: submission.id,
    details: { duplicateKind: review.kind, duplicateId: review.id, changedFields },
  });

  return { kind: review.kind, id: review.id, reviewedShowId, changedFields };
}

export async function approveShowClaimUpdate(
  submissionId: string,
  actor: { reviewerId: string; reviewerRole: UserRole; notes?: string | null }
) {
  if (actor.reviewerRole !== "ADMIN" && actor.reviewerRole !== "MODERATOR") {
    throw new Error("Only admin or moderator reviewers can approve show claims.");
  }
  if (isFixtureMode()) return null;

  const submission = await db.showSubmission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.status !== "PENDING") return null;
  const payload = submission.payloadJson as Record<string, unknown>;
  if (readString(payload, "submissionIntent") !== "CLAIM_OR_UPDATE") {
    throw new Error("This submission is not a show claim.");
  }
  const targetShowId = readString(payload, "claimTargetShowId");
  const organizerId = submission.organizerId ?? readString(payload, "organizerId");
  if (!targetShowId || !organizerId) throw new Error("The claim is missing its show or organizer.");

  const show = await db.show.findUnique({ where: { id: targetShowId }, include: { venue: true } });
  if (!show) throw new Error("The claimed show no longer exists.");
  const title = readString(payload, "showName");
  const startDateText = readString(payload, "startDate");
  const endDateText = readString(payload, "endDate") ?? startDateText;
  const city = readString(payload, "city");
  const state = readString(payload, "state")?.toUpperCase();
  if (!title || !startDateText || !endDateText || !city || !state) throw new Error("The claim is missing required show details.");
  const startDate = new Date(`${startDateText}T00:00:00.000Z`);
  const endDate = new Date(`${endDateText}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) throw new Error("The claim has invalid dates.");

  const dedupeKey = buildShowDedupeKey(payload);
  if (dedupeKey) {
    const duplicate = await db.show.findFirst({ where: { dedupeKey, id: { not: show.id } }, select: { id: true } });
    if (duplicate) throw new DuplicateSubmissionError(duplicate.id);
  }

  let venueId = show.venueId;
  const venueName = readString(payload, "venueName");
  const venueAddress = readString(payload, "venueAddress");
  if (venueName && venueAddress) {
    const coords = getCityCoords(city, state);
    const venue = await db.venue.upsert({
      where: { name_city_state: { name: venueName, city, state } },
      create: { name: venueName, address1: venueAddress, city, state, parkingInfo: readString(payload, "parkingInfo"), latitude: coords?.lat ?? null, longitude: coords?.lng ?? null },
      update: { address1: venueAddress, parkingInfo: readString(payload, "parkingInfo") ?? undefined },
    });
    venueId = venue.id;
  } else if (!venueName || venueName !== show.venue?.name || city !== show.city || state !== show.state) {
    venueId = null;
  }

  const tableCount = Number.parseInt(readString(payload, "tableCount") ?? "", 10);
  const reviewerNote = actor.notes?.trim() || "Claim approved and reviewed updates applied.";
  const updatedShow = await db.$transaction(async (transaction) => {
    const updated = await transaction.show.update({
      where: { id: show.id },
      data: {
        title,
        dedupeKey,
        startDate,
        endDate,
        startTimeLabel: readString(payload, "startTimeLabel"),
        endTimeLabel: readString(payload, "endTimeLabel"),
        city,
        state,
        categories: readStringArray(payload, "categories"),
        description: mergeDescriptionWithDailySchedule(payload),
        tableCount: Number.isFinite(tableCount) && tableCount > 0 ? tableCount : null,
        vendorDetails: readString(payload, "vendorDetails"),
        websiteUrl: normalizeExternalUrl(readString(payload, "websiteUrl")),
        facebookUrl: normalizeExternalUrl(readString(payload, "facebookUrl")),
        isFree: payload.isFree === true,
        admissionPrice: readString(payload, "admissionPrice"),
        admissionNotes: readString(payload, "admissionNotes"),
        parkingInfo: readString(payload, "parkingInfo"),
        flyerImageUrl: readString(payload, "flyerImageUrl") ?? show.flyerImageUrl,
        organizerId,
        venueId,
        lastVerifiedAt: new Date(),
        expiresAt: new Date(endDate.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    await transaction.showSubmission.update({
      where: { id: submission.id },
      data: { status: "APPROVED", reviewedShowId: show.id, reviewerId: actor.reviewerId, reviewerRole: actor.reviewerRole, notes: reviewerNote },
    });
    return updated;
  });

  await writeAuditLog({ actorId: actor.reviewerId, actorRole: actor.reviewerRole, action: "show_claim.approved", targetType: "Show", targetId: show.id, details: { submissionId, organizerId, relationship: readString(payload, "claimRelationship") } });
  await notifyDecision({ email: submission.submitterEmail, payload, decision: "approved", notes: reviewerNote, showSlug: show.slug });
  return updatedShow;
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

  await notifyDecision({ email: submission.submitterEmail, payload: existing.payloadJson as Record<string, unknown> | undefined, decision: "rejected", notes });

  return submission;
}

export async function requestSubmissionCorrections(submissionId: string, notes: string, options: { reviewerId?: string | null; reviewerRole?: UserRole | null }) {
  if (options.reviewerRole !== "ADMIN" && options.reviewerRole !== "MODERATOR") throw new Error("Only reviewers can request corrections.");
  const existing = await db.showSubmission.findUnique({ where: { id: submissionId } });
  if (!existing || existing.status !== "PENDING") return existing;
  const submission = await db.showSubmission.update({ where: { id: submissionId }, data: { notes, reviewerId: options.reviewerId ?? null, reviewerRole: options.reviewerRole ?? null } });
  await writeAuditLog({ actorId: options.reviewerId ?? null, actorRole: options.reviewerRole, action: "submission.corrections_requested", targetType: "ShowSubmission", targetId: submissionId, details: { notes } });
  await notifyDecision({ email: submission.submitterEmail, payload: existing.payloadJson as Record<string, unknown>, decision: "corrections", notes });
  return submission;
}
