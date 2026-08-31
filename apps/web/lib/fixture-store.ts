import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { FixtureShow, FixtureSubmission } from "@/lib/fixture-data";
import { FIXTURE_SHOWS } from "@/lib/fixture-data";
import { slugify } from "@/lib/utils";

const dataDirectory = path.join(process.cwd(), "data");
const localShowsPath = path.join(dataDirectory, "fixture-local-shows.json");
const submissionsPath = path.join(dataDirectory, "fixture-submissions.json");

type SerializedFixtureShow = Omit<
  FixtureShow,
  "startDate" | "endDate" | "lastVerifiedAt" | "expiresAt" | "createdAt" | "updatedAt"
> & {
  startDate: string;
  endDate: string;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SerializedFixtureSubmission = Omit<
  FixtureSubmission,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

async function ensureDataFile(filePath: string) {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, "[]", "utf8");
  }
}

function serializeShow(show: FixtureShow): SerializedFixtureShow {
  return {
    ...show,
    startDate: show.startDate.toISOString(),
    endDate: show.endDate.toISOString(),
    lastVerifiedAt: show.lastVerifiedAt?.toISOString() ?? null,
    expiresAt: show.expiresAt?.toISOString() ?? null,
    createdAt: show.createdAt.toISOString(),
    updatedAt: show.updatedAt.toISOString(),
  };
}

function hydrateShow(show: SerializedFixtureShow): FixtureShow {
  return {
    ...show,
    startDate: new Date(show.startDate),
    endDate: new Date(show.endDate),
    lastVerifiedAt: show.lastVerifiedAt ? new Date(show.lastVerifiedAt) : null,
    expiresAt: show.expiresAt ? new Date(show.expiresAt) : null,
    createdAt: new Date(show.createdAt),
    updatedAt: new Date(show.updatedAt),
  };
}

function serializeSubmission(
  submission: FixtureSubmission
): SerializedFixtureSubmission {
  return {
    ...submission,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  };
}

function hydrateSubmission(
  submission: SerializedFixtureSubmission
): FixtureSubmission {
  return {
    ...submission,
    createdAt: new Date(submission.createdAt),
    updatedAt: new Date(submission.updatedAt),
  };
}

async function readLocalShows() {
  await ensureDataFile(localShowsPath);
  const content = await readFile(localShowsPath, "utf8");
  const data = JSON.parse(content) as SerializedFixtureShow[];
  return data.map(hydrateShow);
}

async function writeLocalShows(shows: FixtureShow[]) {
  await ensureDataFile(localShowsPath);
  await writeFile(
    localShowsPath,
    JSON.stringify(shows.map(serializeShow), null, 2),
    "utf8"
  );
}

async function readSubmissions() {
  await ensureDataFile(submissionsPath);
  const content = await readFile(submissionsPath, "utf8");
  const data = JSON.parse(content) as SerializedFixtureSubmission[];
  return data.map(hydrateSubmission);
}

async function writeSubmissions(submissions: FixtureSubmission[]) {
  await ensureDataFile(submissionsPath);
  await writeFile(
    submissionsPath,
    JSON.stringify(submissions.map(serializeSubmission), null, 2),
    "utf8"
  );
}

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getPayloadStringArray(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (!Array.isArray(value)) return [];

  return value.filter((entry): entry is string => typeof entry === "string");
}

export async function getAllFixtureShows() {
  const localShows = await readLocalShows();
  return [...FIXTURE_SHOWS, ...localShows].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );
}

export async function getFixtureShowById(id: string) {
  const shows = await getAllFixtureShows();
  return shows.find((show) => show.id === id) ?? null;
}

export async function getFixtureShowBySlug(slug: string) {
  const shows = await getAllFixtureShows();
  return shows.find((show) => show.slug === slug) ?? null;
}

export async function updateFixtureShow(
  id: string,
  updates: Partial<Pick<FixtureShow, "status" | "lastVerifiedAt">>
) {
  const localShows = await readLocalShows();
  const showIndex = localShows.findIndex((show) => show.id === id);

  if (showIndex === -1) return null;

  const updatedShow = {
    ...localShows[showIndex],
    ...updates,
    updatedAt: new Date(),
  };

  localShows[showIndex] = updatedShow;
  await writeLocalShows(localShows);

  return updatedShow;
}

export async function getFixtureSubmissions() {
  const submissions = await readSubmissions();
  return submissions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getFixtureSubmissionById(id: string) {
  const submissions = await readSubmissions();
  return submissions.find((submission) => submission.id === id) ?? null;
}

export async function updateFixtureSubmissionPayload(
  submissionId: string,
  payloadJson: Record<string, unknown>
) {
  const submissions = await readSubmissions();
  const submissionIndex = submissions.findIndex((submission) => submission.id === submissionId);

  if (submissionIndex === -1 || submissions[submissionIndex]?.status !== "PENDING") {
    return null;
  }

  const updatedSubmission = {
    ...submissions[submissionIndex],
    payloadJson,
    updatedAt: new Date(),
  };

  submissions[submissionIndex] = updatedSubmission;
  await writeSubmissions(submissions);
  return updatedSubmission;
}

export async function createFixtureSubmission(input: {
  submitterName: string;
  submitterEmail: string;
  payloadJson: Record<string, unknown>;
}) {
  const submissions = await readSubmissions();
  const now = new Date();

  const submission: FixtureSubmission = {
    id: `fixture-submission-${randomUUID()}`,
    submitterName: input.submitterName,
    submitterEmail: input.submitterEmail,
    payloadJson: input.payloadJson,
    status: "PENDING",
    notes: null,
    reviewerId: null,
    reviewerRole: null,
    reviewedShowId: null,
    createdAt: now,
    updatedAt: now,
  };

  submissions.unshift(submission);
  await writeSubmissions(submissions);

  return submission;
}

export async function approveFixtureSubmission(submissionId: string) {
  const submissions = await readSubmissions();
  const submissionIndex = submissions.findIndex((sub) => sub.id === submissionId);

  if (submissionIndex === -1) return null;

  const submission = submissions[submissionIndex];
  const payload = submission.payloadJson;
  const allShows = await getAllFixtureShows();

  const baseSlug = slugify(
    `${getPayloadString(payload, "showName") ?? "show"}-${getPayloadString(payload, "city") ?? ""}-${getPayloadString(payload, "state") ?? ""}`
  );

  const slugExists = (slug: string) => allShows.some((show) => show.slug === slug);
  let finalSlug = baseSlug;
  let suffix = 2;

  while (slugExists(finalSlug)) {
    finalSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const now = new Date();
  const organizerName = getPayloadString(payload, "organizerName");
  const organizerEmail = getPayloadString(payload, "organizerEmail");
  const publicEmail =
    payload.publicPromoterEmailConsent === true
      ? getPayloadString(payload, "publicPromoterEmail")
      : null;
  const venueName = getPayloadString(payload, "venueName");
  const venueAddress = getPayloadString(payload, "venueAddress");

  const organizer =
    organizerName !== null
      ? {
          id: `local-organizer-${randomUUID()}`,
          name: organizerName,
          email: organizerEmail,
          publicEmail,
          publicEmailConsentAt: publicEmail ? now : null,
          websiteUrl: getPayloadString(payload, "websiteUrl"),
          facebookUrl: getPayloadString(payload, "facebookUrl"),
          instagramUrl: null,
          verified: false,
        }
      : null;

  const venue =
    venueName !== null && venueAddress !== null
      ? {
          id: `local-venue-${randomUUID()}`,
          name: venueName,
          address1: venueAddress,
          address2: null,
          city: getPayloadString(payload, "city") ?? "",
          state: getPayloadString(payload, "state") ?? "",
          postalCode: null,
          parkingInfo: getPayloadString(payload, "parkingInfo"),
          loadInInfo: null,
        }
      : null;

  const localShows = await readLocalShows();

  const show: FixtureShow = {
    id: `local-show-${randomUUID()}`,
    title: getPayloadString(payload, "showName") ?? "Untitled Show",
    slug: finalSlug,
    description: getPayloadString(payload, "description"),
    status: "APPROVED",
    sourceType: "SUBMITTED",
    timezone: "America/Chicago",
    startDate: new Date(
      getPayloadString(payload, "startDate") ?? now.toISOString()
    ),
    endDate: new Date(
      getPayloadString(payload, "endDate") ??
        getPayloadString(payload, "startDate") ??
        now.toISOString()
    ),
    startTimeLabel: getPayloadString(payload, "startTimeLabel"),
    endTimeLabel: getPayloadString(payload, "endTimeLabel"),
    city: getPayloadString(payload, "city") ?? "",
    state: getPayloadString(payload, "state") ?? "",
    isFree: payload.isFree === true,
    admissionPrice: getPayloadString(payload, "admissionPrice"),
    admissionNotes: getPayloadString(payload, "admissionNotes"),
    tableCount: Number.parseInt(getPayloadString(payload, "tableCount") ?? "", 10) || null,
    vendorDetails: getPayloadString(payload, "vendorDetails"),
    estimatedAttendance: null,
    flyerImageUrl: null,
    websiteUrl: getPayloadString(payload, "websiteUrl"),
    facebookUrl: getPayloadString(payload, "facebookUrl"),
    ticketUrl: null,
    parkingInfo: getPayloadString(payload, "parkingInfo"),
    loadInInfo: null,
    venueNotes: null,
    categories: getPayloadStringArray(payload, "categories"),
    lastVerifiedAt: now,
    expiresAt: null,
    viewCount: 0,
    favoriteCount: 0,
    featuredRank: null,
    createdAt: now,
    updatedAt: now,
    organizerId: organizer?.id ?? null,
    venueId: venue?.id ?? null,
    organizer,
    venue,
    tags: [],
  };

  localShows.unshift(show);
  await writeLocalShows(localShows);

  submissions[submissionIndex] = {
    ...submission,
    status: "APPROVED",
    reviewerId: submission.reviewerId ?? null,
    reviewerRole: submission.reviewerRole ?? null,
    reviewedShowId: show.id,
    updatedAt: now,
  };

  await writeSubmissions(submissions);

  return show;
}

export async function rejectFixtureSubmission(
  submissionId: string,
  notes: string | null
) {
  const submissions = await readSubmissions();
  const submissionIndex = submissions.findIndex((sub) => sub.id === submissionId);

  if (submissionIndex === -1) return null;

  const updatedSubmission = {
    ...submissions[submissionIndex],
    status: "REJECTED" as const,
    notes,
    reviewerId: submissions[submissionIndex]?.reviewerId ?? null,
    reviewerRole: submissions[submissionIndex]?.reviewerRole ?? null,
    updatedAt: new Date(),
  };

  submissions[submissionIndex] = updatedSubmission;
  await writeSubmissions(submissions);

  return updatedSubmission;
}
