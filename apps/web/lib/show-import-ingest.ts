import { Prisma } from "@csn/db";
import { db } from "@/lib/db";
import { getCityCoords } from "@/lib/city-coords";
import { slugify } from "@/lib/utils";
import { normalizeExternalUrl } from "@/lib/url";

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
};

export type ImportSourceSummary = {
  source: string;
  label: string;
  imported: number;
  skipped: number;
  errors: string[];
};

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function getExistingImportedExternalIds(source: string, externalIds: string[]) {
  const uniqueExternalIds = [...new Set(externalIds.filter(Boolean))];
  if (uniqueExternalIds.length === 0) {
    return new Set<string>();
  }

  const existing = new Set<string>();

  for (const batch of chunkValues(uniqueExternalIds, 250)) {
    const batchRows = await db.$queryRaw<Array<{ externalId: string | null }>>(
      Prisma.sql`
        SELECT "payloadJson"->>'externalId' AS "externalId"
        FROM "ShowSubmission"
        WHERE "payloadJson"->>'source' = ${source}
          AND "payloadJson"->>'externalId' IN (${Prisma.join(batch.map((value) => Prisma.sql`${value}`))})
      `
    );

    for (const row of batchRows) {
      if (row.externalId) {
        existing.add(row.externalId);
      }
    }
  }

  return existing;
}

export async function ingestImportedShows(input: {
  source: string;
  label: string;
  submitterName: string;
  submitterEmail: string;
  shows: ImportedShow[];
}) {
  let imported = 0;
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

  const existingExternalIds = await getExistingImportedExternalIds(input.source, [...uniqueShows.keys()]);

  for (const show of uniqueShows.values()) {
    try {
      if (existingExternalIds.has(show.externalId)) {
        skipped++;
        continue;
      }

      const duplicate = await db.show.findFirst({
        where: {
          title: { equals: show.title, mode: "insensitive" },
          city: { equals: show.city, mode: "insensitive" },
          state: show.state,
          startDate: show.startDate,
        },
      });
      if (duplicate) {
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
          payloadJson: {
            externalId: show.externalId,
            showName: show.title,
            description: show.description,
            startDate: show.startDate.toISOString().split("T")[0],
            endDate: show.endDate.toISOString().split("T")[0],
            city: show.city,
            state: show.state,
            venueName: show.venueName ?? "",
            venueAddress: show.venueAddress ?? "",
            categories: show.categories,
            isFree: show.isFree,
            admissionPrice: show.admissionPrice ?? "",
            admissionNotes: show.admissionNotes ?? "",
            websiteUrl: normalizeExternalUrl(show.websiteUrl),
            facebookUrl: normalizeExternalUrl(show.facebookUrl),
            organizerName: show.organizerName ?? "",
            organizerEmail: "",
            source: input.source,
            sourceUrl: normalizeExternalUrl(show.sourceUrl) ?? "",
            venueId,
            slug,
          },
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
    skipped,
    errors,
  } satisfies ImportSourceSummary;
}
