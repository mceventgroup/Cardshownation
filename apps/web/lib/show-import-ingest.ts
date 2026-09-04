import { Prisma } from "@csn/db";
import { db } from "@/lib/db";
import { getCityCoords } from "@/lib/city-coords";
import { slugify } from "@/lib/utils";
import { normalizeExternalUrl } from "@/lib/url";
import { buildShowDedupeKey, findDuplicateForPayload } from "@/lib/submissions";

export type ImportedShow = {
  externalId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  city: string;
  state: string;
  venueName: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  isFree: boolean;
  admissionPrice: string | null;
  websiteUrl: string | null;
  facebookUrl?: string | null;
  categories: string[];
  organizerName: string | null;
  admissionNotes?: string | null;
  sourceUrl?: string | null;
  startTimeLabel?: string | null;
  endTimeLabel?: string | null;
  tableCount?: number | null;
};

export type ImportSourceSummary = {
  source: string;
  label: string;
  imported: number;
  enriched: number;
  skipped: number;
  errors: string[];
};

const ENRICHABLE_PAYLOAD_FIELDS = [
  "description", "venueName", "venueAddress", "startTimeLabel", "endTimeLabel",
  "admissionPrice", "admissionNotes", "tableCount", "websiteUrl", "facebookUrl",
] as const;

function hasUsefulValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

export function mergeMissingImportedDetails(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
) {
  const merged = { ...existing };
  const changedFields: string[] = [];

  for (const field of ENRICHABLE_PAYLOAD_FIELDS) {
    if (!hasUsefulValue(merged[field]) && hasUsefulValue(incoming[field])) {
      merged[field] = incoming[field];
      changedFields.push(field);
    }
  }

  const existingCategories = Array.isArray(existing.categories)
    ? existing.categories.filter((value): value is string => typeof value === "string")
    : [];
  const incomingCategories = Array.isArray(incoming.categories)
    ? incoming.categories.filter((value): value is string => typeof value === "string")
    : [];
  const mergedCategories = [...new Set([...existingCategories, ...incomingCategories])];
  if (mergedCategories.length > existingCategories.length) {
    merged.categories = mergedCategories;
    changedFields.push("categories");
  }

  if (existing.isFree !== true && incoming.isFree === true && !hasUsefulValue(existing.admissionPrice)) {
    merged.isFree = true;
    changedFields.push("isFree");
  }

  return { merged, changedFields };
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function getExistingImportedRecords(source: string, externalIds: string[]) {
  const uniqueExternalIds = [...new Set(externalIds.filter(Boolean))];
  if (uniqueExternalIds.length === 0) {
    return new Map<string, { submissionId: string; reviewedShowId: string | null }>();
  }

  const existing = new Map<string, { submissionId: string; reviewedShowId: string | null }>();

  for (const batch of chunkValues(uniqueExternalIds, 250)) {
    const batchRows = await db.$queryRaw<Array<{ externalId: string | null; submissionId: string; reviewedShowId: string | null }>>(
      Prisma.sql`
        SELECT "payloadJson"->>'externalId' AS "externalId", "id" AS "submissionId", "reviewedShowId"
        FROM "ShowSubmission"
        WHERE "payloadJson"->>'source' = ${source}
          AND "payloadJson"->>'externalId' IN (${Prisma.join(batch.map((value) => Prisma.sql`${value}`))})
      `
    );

    for (const row of batchRows) {
      if (row.externalId) {
        existing.set(row.externalId, { submissionId: row.submissionId, reviewedShowId: row.reviewedShowId });
      }
    }
  }

  return existing;
}

function importedPayload(show: ImportedShow, source: string, suppressSourceLinks: boolean, venueId: string | null = null) {
  return {
    externalId: show.externalId,
    showName: show.title,
    description: show.description,
    startDate: show.startDate.toISOString().split("T")[0],
    endDate: show.endDate.toISOString().split("T")[0],
    startTimeLabel: show.startTimeLabel ?? "",
    endTimeLabel: show.endTimeLabel ?? "",
    city: show.city,
    state: show.state,
    venueName: show.venueName ?? "",
    venueAddress: show.venueAddress ?? "",
    categories: show.categories,
    isFree: show.isFree,
    admissionPrice: show.admissionPrice ?? "",
    admissionNotes: show.admissionNotes ?? "",
    tableCount: show.tableCount ? String(show.tableCount) : "",
    websiteUrl: suppressSourceLinks ? null : normalizeExternalUrl(show.websiteUrl),
    facebookUrl: normalizeExternalUrl(show.facebookUrl),
    organizerName: show.organizerName ?? "",
    organizerEmail: "",
    source,
    sourceUrl: suppressSourceLinks ? "" : normalizeExternalUrl(show.sourceUrl) ?? "",
    venueId,
  } satisfies Record<string, unknown>;
}

function readPayloadText(payload: Record<string, unknown>, field: string) {
  const value = payload[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function ensureImportedVenue(payload: Record<string, unknown>) {
  const name = readPayloadText(payload, "venueName");
  const address = readPayloadText(payload, "venueAddress");
  const city = readPayloadText(payload, "city");
  const state = readPayloadText(payload, "state");
  if (!name || !address || !city || !state) return null;
  const coords = getCityCoords(city, state);
  return db.venue.upsert({
    where: { name_city_state: { name, city, state } },
    create: {
      name,
      address1: address,
      city,
      state,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    },
    update: {},
  });
}

async function enrichPublishedShow(showId: string, incoming: Record<string, unknown>) {
  const show = await db.show.findUnique({ where: { id: showId }, include: { venue: true } });
  if (!show) return false;
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
    categories: show.categories,
    isFree: show.isFree,
  } satisfies Record<string, unknown>;
  const { merged, changedFields } = mergeMissingImportedDetails(current, incoming);
  if (changedFields.length === 0) return false;

  let venueId: string | undefined;
  if (!show.venueId && changedFields.some((field) => field === "venueName" || field === "venueAddress")) {
    venueId = (await ensureImportedVenue({ ...incoming, ...merged }))?.id;
  }
  const tableCount = Number.parseInt(String(merged.tableCount ?? ""), 10);
  await db.show.update({
    where: { id: showId },
    data: {
      description: readPayloadText(merged, "description"),
      startTimeLabel: readPayloadText(merged, "startTimeLabel"),
      endTimeLabel: readPayloadText(merged, "endTimeLabel"),
      admissionPrice: readPayloadText(merged, "admissionPrice"),
      admissionNotes: readPayloadText(merged, "admissionNotes"),
      tableCount: Number.isFinite(tableCount) && tableCount > 0 ? tableCount : null,
      websiteUrl: normalizeExternalUrl(readPayloadText(merged, "websiteUrl")),
      facebookUrl: normalizeExternalUrl(readPayloadText(merged, "facebookUrl")),
      categories: Array.isArray(merged.categories) ? merged.categories.filter((value): value is string => typeof value === "string") : show.categories,
      isFree: merged.isFree === true,
      ...(venueId ? { venueId } : {}),
    },
  });
  return true;
}

async function enrichSubmission(submissionId: string, incoming: Record<string, unknown>) {
  const submission = await db.showSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return false;
  if (submission.reviewedShowId) return enrichPublishedShow(submission.reviewedShowId, incoming);
  const current = submission.payloadJson as Record<string, unknown>;
  const { merged, changedFields } = mergeMissingImportedDetails(current, incoming);
  if (changedFields.length === 0) return false;
  await db.showSubmission.update({ where: { id: submissionId }, data: { payloadJson: merged as object } });
  return true;
}

async function enrichDuplicate(
  duplicate: { kind: "show" | "submission"; id: string },
  incoming: Record<string, unknown>
) {
  return duplicate.kind === "show"
    ? enrichPublishedShow(duplicate.id, incoming)
    : enrichSubmission(duplicate.id, incoming);
}

export async function recordImportFailure(input: { source: string; label: string; error: string }) {
  try {
    await db.importLog.create({
      data: { source: input.source, imported: 0, skipped: 0, errors: 1, errorDetails: input.error },
    });
  } catch (logError) {
    console.error("[auto-import] unable to record source failure", { source: input.source, logError });
  }
  return { source: input.source, label: input.label, imported: 0, enriched: 0, skipped: 0, errors: [input.error] } satisfies ImportSourceSummary;
}

export async function ingestImportedShows(input: {
  source: string;
  label: string;
  submitterName: string;
  submitterEmail: string;
  shows: ImportedShow[];
}) {
  const suppressSourceLinks = input.source.toLowerCase() === "tcdb";
  let imported = 0;
  let enriched = 0;
  let skipped = 0;
  const errors: string[] = [];
  const uniqueShows = new Map<string, ImportedShow>();

  for (const show of input.shows) {
    if (!show.externalId) {
      continue;
    }

    if (uniqueShows.has(show.externalId)) {
      skipped++;
      continue;
    }

    uniqueShows.set(show.externalId, show);
  }

  const existingRecords = await getExistingImportedRecords(input.source, [...uniqueShows.keys()]);

  for (const show of uniqueShows.values()) {
    try {
      const candidatePayload = importedPayload(show, input.source, suppressSourceLinks);
      const existingRecord = existingRecords.get(show.externalId);
      if (existingRecord) {
        const didEnrich = existingRecord.reviewedShowId
          ? await enrichPublishedShow(existingRecord.reviewedShowId, candidatePayload)
          : await enrichSubmission(existingRecord.submissionId, candidatePayload);
        if (didEnrich) enriched++;
        skipped++;
        continue;
      }

      const duplicate = await findDuplicateForPayload(candidatePayload, { includePending: true });
      if (duplicate) {
        if (await enrichDuplicate(duplicate, candidatePayload)) enriched++;
        skipped++;
        continue;
      }

      let venueId: string | null = null;
      if (show.venueName && show.venueAddress) {
        const coords =
          show.venueLat && show.venueLng
            ? { lat: show.venueLat, lng: show.venueLng }
            : getCityCoords(show.city, show.state);

        const venue = await db.venue.upsert({
          where: {
            name_city_state: {
              name: show.venueName,
              city: show.city,
              state: show.state,
            },
          },
          create: {
            name: show.venueName,
            address1: show.venueAddress,
            city: show.city,
            state: show.state,
            latitude: coords?.lat ?? null,
            longitude: coords?.lng ?? null,
          },
          update: {},
        });
        venueId = venue.id;
      }

      const baseSlug = slugify(`${show.title}-${show.city}-${show.state}`);
      let slug = baseSlug;
      let suffix = 2;
      while (await db.show.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }

      await db.showSubmission.create({
        data: {
          submitterName: input.submitterName,
          submitterEmail: input.submitterEmail,
          status: "PENDING",
          dedupeKey: buildShowDedupeKey(candidatePayload),
          payloadJson: { ...candidatePayload, venueId, slug },
        },
      });

      imported++;
    } catch (err) {
      errors.push(`${show.title}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await db.importLog.create({
    data: {
      source: input.source,
      imported,
      skipped,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors.join("\n") : null,
    },
  });

  return {
    source: input.source,
    label: input.label,
    imported,
    enriched,
    skipped,
    errors,
  } satisfies ImportSourceSummary;
}
