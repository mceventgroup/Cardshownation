import { Prisma } from "@csn/db";
import type { UserRole } from "@csn/db";
import { customAlphabet } from "nanoid";
import { writeAuditLog } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { getCityCoords } from "@/lib/city-coords";
import { resolveManagedFlyerImageUrl } from "@/lib/flyers";
import type { FixtureShow } from "@/lib/fixture-data";
import {
  getAllFixtureShows,
  getFixtureShowById,
  getFixtureShowBySlug,
} from "@/lib/fixture-store";
import { slugify } from "@/lib/utils";
import { normalizeExternalUrl } from "@/lib/url";

export const SHOW_CATEGORIES = [
  "Sports Cards",
  "Pokemon",
  "TCG",
  "Mixed",
  "Memorabilia",
  "Comics",
  "Trade Night",
  "Autograph Guests",
] as const;

const categoryAliases: Record<string, string> = {
  sports: "Sports Cards",
  "sports cards": "Sports Cards",
  pokemon: "Pokemon",
  tcg: "TCG",
  mixed: "Mixed",
  memorabilia: "Memorabilia",
  comics: "Comics",
  "trade night": "Trade Night",
  "autograph guests": "Autograph Guests",
};

const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

export type ParsedShowRow = {
  rowNumber: number;
  title?: string;
  startDate?: string;
  endDate?: string;
  startTimeLabel?: string;
  endTimeLabel?: string;
  city?: string;
  state?: string;
  timezone?: string;
  isFree?: string;
  admissionPrice?: string;
  admissionNotes?: string;
  tableCount?: string;
  estimatedAttendance?: string;
  categories?: string;
  description?: string;
  websiteUrl?: string;
  facebookUrl?: string;
  ticketUrl?: string;
  venueName?: string;
  venueAddress1?: string;
  venueAddress2?: string;
  venuePostalCode?: string;
  vendorDetails?: string;
  parkingInfo?: string;
  loadInInfo?: string;
  venueNotes?: string;
  flyerImageUrl?: string;
};

type BulkCreateShowsResult = {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

type AdminShowUpdateInput = {
  title: string;
  startDate: string;
  endDate: string;
  startTimeLabel?: string | null;
  endTimeLabel?: string | null;
  city: string;
  state: string;
  isFree: boolean;
  admissionPrice?: string | null;
  admissionNotes?: string | null;
  tableCount?: string | null;
  estimatedAttendance?: string | null;
  categories?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  ticketUrl?: string | null;
  vendorDetails?: string | null;
  parkingInfo?: string | null;
  loadInInfo?: string | null;
  venueNotes?: string | null;
  flyerImageUrl?: string | null;
  venueName?: string | null;
  venueAddress1?: string | null;
  venueAddress2?: string | null;
  venuePostalCode?: string | null;
};

function normalizeCsvString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseRequiredDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalInteger(value: string | null) {
  if (!value) return { value: null as number | null, error: null as string | null };
  if (!/^-?\d+$/.test(value)) {
    return { value: null, error: "must be a whole number" };
  }

  return { value: Number.parseInt(value, 10), error: null };
}

function parseCategories(value: string | null) {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => categoryAliases[item.toLowerCase()] ?? item);
}

function parseDateInput(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDuplicateToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildShowDuplicateKey(input: {
  title: string;
  city: string;
  state: string;
  startDate: Date;
}) {
  return [
    normalizeDuplicateToken(input.title),
    input.startDate.toISOString().slice(0, 10),
    normalizeDuplicateToken(input.city),
    input.state.trim().toUpperCase(),
  ].join("|");
}

const showCardSelect = {
  id: true,
  title: true,
  slug: true,
  city: true,
  state: true,
  startDate: true,
  endDate: true,
  startTimeLabel: true,
  endTimeLabel: true,
  isFree: true,
  admissionPrice: true,
  categories: true,
  flyerImageUrl: true,
  tableCount: true,
  vendorDetails: true,
  featuredRank: true,
  venue: { select: { name: true } },
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function upcomingWhere() {
  const today = startOfToday();

  return {
    status: "APPROVED" as const,
    startDate: { gte: today },
    OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
  };
}

function compareKansasPriority(aState: string, bState: string) {
  if (aState === "KS" && bState !== "KS") {
    return -1;
  }

  if (aState !== "KS" && bState === "KS") {
    return 1;
  }

  return aState.localeCompare(bState);
}

function sortShows(
  a: { featuredRank: number | null; startDate: Date; state: string; city: string; title: string },
  b: { featuredRank: number | null; startDate: Date; state: string; city: string; title: string }
) {
  const featuredA = a.featuredRank ?? Number.POSITIVE_INFINITY;
  const featuredB = b.featuredRank ?? Number.POSITIVE_INFINITY;

  if (featuredA !== featuredB) {
    return featuredA - featuredB;
  }

  const startDateDiff = a.startDate.getTime() - b.startDate.getTime();
  if (startDateDiff !== 0) {
    return startDateDiff;
  }

  const stateDiff = compareKansasPriority(a.state, b.state);
  if (stateDiff !== 0) {
    return stateDiff;
  }

  const cityDiff = a.city.localeCompare(b.city);
  if (cityDiff !== 0) {
    return cityDiff;
  }

  return a.title.localeCompare(b.title);
}

function isUpcomingFixtureShow(show: FixtureShow) {
  const today = startOfToday();
  return (
    show.status === "APPROVED" &&
    show.startDate >= today &&
    (!show.expiresAt || show.expiresAt >= today)
  );
}

function projectShowCard(show: FixtureShow) {
  return {
    id: show.id,
    title: show.title,
    slug: show.slug,
    city: show.city,
    state: show.state,
    startDate: show.startDate,
    endDate: show.endDate,
    startTimeLabel: show.startTimeLabel,
    endTimeLabel: show.endTimeLabel,
    isFree: show.isFree,
    admissionPrice: show.admissionPrice,
    categories: show.categories,
    flyerImageUrl: show.flyerImageUrl,
    tableCount: show.tableCount,
    vendorDetails: show.vendorDetails,
    featuredRank: show.featuredRank,
    venue: show.venue ? { name: show.venue.name } : null,
  };
}

async function filterFixtureShows({
  state,
  city,
  category,
  isFree,
  q,
}: {
  state?: string;
  city?: string;
  category?: string;
  isFree?: boolean;
  q?: string;
}) {
  const shows = await getAllFixtureShows();
  const normalizedQuery = q?.trim().toLowerCase();

  return shows.filter((show) => {
    if (!isUpcomingFixtureShow(show)) return false;
    if (state && show.state !== state) return false;
    if (city && !show.city.toLowerCase().includes(city.toLowerCase())) return false;
    if (category && !show.categories.includes(category)) return false;
    if (isFree !== undefined && show.isFree !== isFree) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      show.title,
      show.city,
      show.description ?? "",
      show.venue?.name ?? "",
      show.organizer?.name ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export async function getFeaturedShows(limit = 6) {
  if (isFixtureMode()) {
    const shows = (await filterFixtureShows({}))
      .filter((show) => show.featuredRank !== null)
      .sort(sortShows)
      .slice(0, limit)
      .map(projectShowCard);

    return shows;
  }

  return db.show.findMany({
    where: {
      ...upcomingWhere(),
      featuredRank: { not: null },
    },
    orderBy: [{ featuredRank: "asc" }, { startDate: "asc" }],
    take: limit,
    select: showCardSelect,
  });
}

export async function getUpcomingShows({
  state,
  city,
  category,
  isFree,
  q,
  limit = 24,
  offset = 0,
}: {
  state?: string;
  city?: string;
  category?: string;
  isFree?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  if (isFixtureMode()) {
    const filteredShows = (await filterFixtureShows({
      state,
      city,
      category,
      isFree,
      q,
    })).sort(sortShows);

    return {
      shows: filteredShows.slice(offset, offset + limit).map(projectShowCard),
      total: filteredShows.length,
    };
  }

  const today = startOfToday();
  const where: any = upcomingWhere();
  const clauses: Prisma.Sql[] = [
    Prisma.sql`s.status = 'APPROVED'`,
    Prisma.sql`s."startDate" >= ${today}`,
    Prisma.sql`(s."expiresAt" IS NULL OR s."expiresAt" >= ${today})`,
  ];

  if (state) {
    where.state = state;
    clauses.push(Prisma.sql`s.state = ${state}`);
  }

  if (city) {
    where.city = { contains: city, mode: "insensitive" };
    clauses.push(Prisma.sql`s.city ILIKE ${`%${city}%`}`);
  }

  if (category) {
    where.categories = { has: category };
    clauses.push(Prisma.sql`${category} = ANY(s.categories)`);
  }

  if (isFree !== undefined) {
    where.isFree = isFree;
    clauses.push(Prisma.sql`s."isFree" = ${isFree}`);
  }

  if (q) {
    where.AND = [
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { venue: { is: { name: { contains: q, mode: "insensitive" } } } },
          { organizer: { is: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
    ];

    const pattern = `%${q}%`;
    clauses.push(Prisma.sql`(
      s.title ILIKE ${pattern}
      OR s.city ILIKE ${pattern}
      OR COALESCE(s.description, '') ILIKE ${pattern}
      OR COALESCE(v.name, '') ILIKE ${pattern}
      OR COALESCE(o.name, '') ILIKE ${pattern}
    )`);
  }

  type UpcomingRow = {
    id: string;
    title: string;
    slug: string;
    city: string;
    state: string;
    startDate: Date;
    endDate: Date;
    startTimeLabel: string | null;
    endTimeLabel: string | null;
    isFree: boolean;
    admissionPrice: string | null;
    categories: string[];
    flyerImageUrl: string | null;
    tableCount: number | null;
    vendorDetails: string | null;
    featuredRank: number | null;
    venueName: string | null;
  };

  const [firstClause, ...remainingClauses] = clauses;
  const whereClause = remainingClauses.reduce(
    (sql, clause) => Prisma.sql`${sql} AND ${clause}`,
    firstClause ?? Prisma.sql`TRUE`
  );

  const [shows, total] = await Promise.all([
    db.$queryRaw<UpcomingRow[]>(Prisma.sql`
      SELECT
        s.id,
        s.title,
        s.slug,
        s.city,
        s.state,
        s."startDate",
        s."endDate",
        s."startTimeLabel",
        s."endTimeLabel",
        s."isFree",
        s."admissionPrice",
        s.categories,
        s."flyerImageUrl",
        s."tableCount",
        s."vendorDetails",
        s."featuredRank",
        v.name AS "venueName"
      FROM "Show" s
      LEFT JOIN "Venue" v ON v.id = s."venueId"
      LEFT JOIN "Organizer" o ON o.id = s."organizerId"
      WHERE ${whereClause}
      ORDER BY
        COALESCE(s."featuredRank", 2147483647) ASC,
        s."startDate" ASC,
        CASE WHEN s.state = 'KS' THEN 0 ELSE 1 END ASC,
        s.state ASC,
        s.city ASC,
        s.title ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        city: row.city,
        state: row.state,
        startDate: row.startDate,
        endDate: row.endDate,
        startTimeLabel: row.startTimeLabel,
        endTimeLabel: row.endTimeLabel,
        isFree: row.isFree,
        admissionPrice: row.admissionPrice,
        categories: row.categories,
        flyerImageUrl: row.flyerImageUrl,
        tableCount: row.tableCount,
        vendorDetails: row.vendorDetails,
        featuredRank: row.featuredRank,
        venue: row.venueName ? { name: row.venueName } : null,
      }))
    ),
    db.show.count({ where }),
  ]);

  return { shows, total };
}

export async function getShowsByState(stateCode: string, limit = 24) {
  if (isFixtureMode()) {
    return (await filterFixtureShows({ state: stateCode }))
      .sort(sortShows)
      .slice(0, limit)
      .map(projectShowCard);
  }

  return db.show.findMany({
    where: {
      ...upcomingWhere(),
      state: stateCode,
    },
    orderBy: [{ featuredRank: "asc" }, { startDate: "asc" }],
    take: limit,
    select: showCardSelect,
  });
}

export async function getShowsByCity(
  stateCode: string,
  city: string,
  limit = 24
) {
  if (isFixtureMode()) {
    return (await filterFixtureShows({ state: stateCode, city }))
      .filter((show) => show.city.toLowerCase() === city.toLowerCase())
      .sort(sortShows)
      .slice(0, limit)
      .map(projectShowCard);
  }

  return db.show.findMany({
    where: {
      ...upcomingWhere(),
      state: stateCode,
      city: { equals: city, mode: "insensitive" },
    },
    orderBy: [{ featuredRank: "asc" }, { startDate: "asc" }],
    take: limit,
    select: showCardSelect,
  });
}

export async function getShowBySlug(slug: string) {
  if (isFixtureMode()) {
    return getFixtureShowBySlug(slug);
  }

  return db.show.findUnique({
    where: { slug },
    include: {
      venue: true,
      organizer: true,
      tags: true,
    },
  });
}

export async function getCitiesWithShows(stateCode: string) {
  if (isFixtureMode()) {
    const cityCounts = new Map<string, number>();

    (await filterFixtureShows({ state: stateCode })).forEach((show) => {
      cityCounts.set(show.city, (cityCounts.get(show.city) ?? 0) + 1);
    });

    return [...cityCounts.entries()]
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
  }

  const results = await db.show.groupBy({
    by: ["city"],
    where: {
      ...upcomingWhere(),
      state: stateCode,
    },
    _count: { city: true },
    orderBy: { _count: { city: "desc" } },
  });

  return results.map((result) => ({
    city: result.city,
    count: result._count.city,
  }));
}

export async function getStatesWithShows() {
  if (isFixtureMode()) {
    const stateCounts = new Map<string, number>();

    (await filterFixtureShows({})).forEach((show) => {
      stateCounts.set(show.state, (stateCounts.get(show.state) ?? 0) + 1);
    });

    return [...stateCounts.entries()]
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
  }

  const results = await db.show.groupBy({
    by: ["state"],
    where: upcomingWhere(),
    _count: { state: true },
    orderBy: { _count: { state: "desc" } },
  });

  return results.map((result) => ({
    state: result.state,
    count: result._count.state,
  }));
}

export async function getHomepageDirectoryStats() {
  if (isFixtureMode()) {
    const shows = await filterFixtureShows({});
    const states = new Set(shows.map((show) => show.state));

    return {
      upcomingShows: shows.length,
      activeStates: states.size,
    };
  }

  const [upcomingShows, activeStates] = await Promise.all([
    db.show.count({ where: upcomingWhere() }),
    db.show
      .groupBy({
        by: ["state"],
        where: upcomingWhere(),
      })
      .then((states) => states.length),
  ]);

  return {
    upcomingShows,
    activeStates,
  };
}

export async function getAdminShowStats() {
  const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  if (isFixtureMode()) {
    const shows = await getAllFixtureShows();

    return {
      pending: shows.filter((show) => show.status === "PENDING").length,
      approved: shows.filter((show) => show.status === "APPROVED").length,
      rejected: shows.filter((show) => show.status === "REJECTED").length,
      stale: shows.filter(
        (show) =>
          show.status === "APPROVED" &&
          (!show.lastVerifiedAt || show.lastVerifiedAt < staleDate)
      ).length,
    };
  }

  const [pending, approved, rejected, stale] = await Promise.all([
    db.show.count({ where: { status: "PENDING" } }),
    db.show.count({ where: { status: "APPROVED" } }),
    db.show.count({ where: { status: "REJECTED" } }),
    db.show.count({
      where: {
        status: "APPROVED",
        OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: staleDate } }],
      },
    }),
  ]);

  return { pending, approved, rejected, stale };
}

export async function bulkCreateShows(
  rows: ParsedShowRow[],
  actor?: {
    actorId?: string | null;
    actorRole?: UserRole | null;
  }
): Promise<BulkCreateShowsResult> {
  if (actor?.actorRole !== "ADMIN") {
    throw new Error("Only admins can bulk import shows.");
  }

  if (isFixtureMode()) {
    return {
      created: 0,
      skipped: rows.length,
      errors: rows.map((row) => ({
        row: row.rowNumber,
        message: "Bulk upload is unavailable in fixture mode.",
      })),
    };
  }

  const errors: BulkCreateShowsResult["errors"] = [];
  const validRows: Array<{
    rowNumber: number;
    title: string;
    startDate: Date;
    endDate: Date;
    startTimeLabel: string | null;
    endTimeLabel: string | null;
    city: string;
    state: string;
    timezone: string;
    isFree: boolean;
    admissionPrice: string | null;
    admissionNotes: string | null;
    tableCount: number | null;
    estimatedAttendance: number | null;
    categories: string[];
    description: string | null;
    websiteUrl: string | null;
    facebookUrl: string | null;
    ticketUrl: string | null;
    venueName: string | null;
    venueAddress1: string | null;
    venueAddress2: string | null;
    venuePostalCode: string | null;
    vendorDetails: string | null;
    parkingInfo: string | null;
    loadInInfo: string | null;
    venueNotes: string | null;
    flyerImageUrl: string | null;
  }> = [];

  for (const row of rows) {
    const title = normalizeCsvString(row.title);
    const startDateValue = normalizeCsvString(row.startDate);
    const endDateValue = normalizeCsvString(row.endDate);
    const city = normalizeCsvString(row.city);
    const state = normalizeCsvString(row.state)?.toUpperCase() ?? null;
    const startDate = parseRequiredDate(startDateValue);
    const endDate = parseRequiredDate(endDateValue);
    const tableCount = parseOptionalInteger(normalizeCsvString(row.tableCount));
    const estimatedAttendance = parseOptionalInteger(
      normalizeCsvString(row.estimatedAttendance)
    );
    const isFreeValue = normalizeCsvString(row.isFree)?.toLowerCase();

    if (!title || !startDateValue || !endDateValue || !city || !state) {
      errors.push({
        row: row.rowNumber,
        message: "Missing required fields: title, startDate, endDate, city, and state are required.",
      });
      continue;
    }

    if (!startDate || !endDate) {
      errors.push({
        row: row.rowNumber,
        message: "startDate and endDate must be valid YYYY-MM-DD dates.",
      });
      continue;
    }

    if (endDate < startDate) {
      errors.push({
        row: row.rowNumber,
        message: "endDate must be on or after startDate.",
      });
      continue;
    }

    if (!/^[A-Z]{2}$/.test(state)) {
      errors.push({
        row: row.rowNumber,
        message: "state must be a 2-letter code.",
      });
      continue;
    }

    if (isFreeValue && !["true", "false"].includes(isFreeValue)) {
      errors.push({
        row: row.rowNumber,
        message: 'isFree must be "true" or "false".',
      });
      continue;
    }

    if (tableCount.error) {
      errors.push({
        row: row.rowNumber,
        message: "tableCount must be numeric when provided.",
      });
      continue;
    }

    if (estimatedAttendance.error) {
      errors.push({
        row: row.rowNumber,
        message: "estimatedAttendance must be numeric when provided.",
      });
      continue;
    }

    validRows.push({
      rowNumber: row.rowNumber,
      title,
      startDate,
      endDate,
      startTimeLabel: normalizeCsvString(row.startTimeLabel),
      endTimeLabel: normalizeCsvString(row.endTimeLabel),
      city,
      state,
      timezone: normalizeCsvString(row.timezone) ?? "America/Chicago",
      isFree: isFreeValue === "true",
      admissionPrice: normalizeCsvString(row.admissionPrice),
      admissionNotes: normalizeCsvString(row.admissionNotes),
      tableCount: tableCount.value,
      estimatedAttendance: estimatedAttendance.value,
      categories: parseCategories(normalizeCsvString(row.categories)),
      description: normalizeCsvString(row.description),
      websiteUrl: normalizeCsvString(row.websiteUrl),
      facebookUrl: normalizeCsvString(row.facebookUrl),
      ticketUrl: normalizeCsvString(row.ticketUrl),
      venueName: normalizeCsvString(row.venueName),
      venueAddress1: normalizeCsvString(row.venueAddress1),
      venueAddress2: normalizeCsvString(row.venueAddress2),
      venuePostalCode: normalizeCsvString(row.venuePostalCode),
      vendorDetails: normalizeCsvString(row.vendorDetails),
      parkingInfo: normalizeCsvString(row.parkingInfo),
      loadInInfo: normalizeCsvString(row.loadInInfo),
      venueNotes: normalizeCsvString(row.venueNotes),
      flyerImageUrl: normalizeCsvString(row.flyerImageUrl),
    });
  }

  const uniqueRows: typeof validRows = [];
  const seenDuplicateKeys = new Set<string>();

  for (const row of validRows) {
    const duplicateKey = buildShowDuplicateKey(row);
    if (seenDuplicateKeys.has(duplicateKey)) {
      errors.push({
        row: row.rowNumber,
        message: "Duplicate row in this CSV import (same title, start date, city, and state).",
      });
      continue;
    }

    seenDuplicateKeys.add(duplicateKey);
    uniqueRows.push(row);
  }

  const importStates = [...new Set(uniqueRows.map((row) => row.state))];
  const importStartDates = uniqueRows.map((row) => row.startDate.getTime());
  const existingDuplicateKeys = new Set<string>();

  if (importStates.length > 0 && importStartDates.length > 0) {
    const minStartDate = new Date(Math.min(...importStartDates));
    const maxStartDate = new Date(Math.max(...importStartDates));
    const existingShows = await db.show.findMany({
      where: {
        state: { in: importStates },
        startDate: {
          gte: minStartDate,
          lte: maxStartDate,
        },
      },
      select: {
        title: true,
        city: true,
        state: true,
        startDate: true,
      },
    });

    for (const show of existingShows) {
      existingDuplicateKeys.add(buildShowDuplicateKey(show));
    }
  }

  const rowsToPrepare: typeof validRows = [];

  for (const row of uniqueRows) {
    if (existingDuplicateKeys.has(buildShowDuplicateKey(row))) {
      errors.push({
        row: row.rowNumber,
        message: "Duplicate of an existing show (same title, start date, city, and state).",
      });
      continue;
    }

    rowsToPrepare.push(row);
  }

  const preparedRows: typeof validRows = [];

  for (const row of rowsToPrepare) {
    try {
      preparedRows.push({
        ...row,
        flyerImageUrl: await resolveManagedFlyerImageUrl(row.title, row.flyerImageUrl),
      });
    } catch (error) {
      errors.push({
        row: row.rowNumber,
        message:
          error instanceof Error
            ? `flyerImageUrl: ${error.message}`
            : "flyerImageUrl could not be normalized.",
      });
    }
  }

  await db.$transaction(async (tx) => {
    for (const row of preparedRows) {
      let venueId: string | null = null;

      if (row.venueName) {
        const venue = await tx.venue.upsert({
          where: {
            name_city_state: {
              name: row.venueName,
              city: row.city,
              state: row.state,
            },
          },
          create: {
            name: row.venueName,
            address1: row.venueAddress1 ?? "Address unavailable",
            address2: row.venueAddress2,
            city: row.city,
            state: row.state,
            postalCode: row.venuePostalCode,
            parkingInfo: row.parkingInfo,
            loadInInfo: row.loadInInfo,
          },
          update: {
            address1: row.venueAddress1 ?? undefined,
            address2: row.venueAddress2 ?? undefined,
            postalCode: row.venuePostalCode ?? undefined,
            parkingInfo: row.parkingInfo ?? undefined,
            loadInInfo: row.loadInInfo ?? undefined,
          },
        });

        venueId = venue.id;
      }

      const baseSlug = slugify(
        `${row.title}-${row.city}-${row.state}-${row.startDate.toISOString().slice(0, 10)}`
      );

      await tx.show.create({
        data: {
          title: row.title,
          slug: `${baseSlug}-${slugSuffix()}`,
          status: "APPROVED",
          // The current schema uses MANUAL for admin-created records.
          sourceType: "MANUAL",
          timezone: row.timezone,
          startDate: row.startDate,
          endDate: row.endDate,
          startTimeLabel: row.startTimeLabel,
          endTimeLabel: row.endTimeLabel,
          city: row.city,
          state: row.state,
          isFree: row.isFree,
          admissionPrice: row.admissionPrice,
          admissionNotes: row.admissionNotes,
          tableCount: row.tableCount,
          estimatedAttendance: row.estimatedAttendance,
          categories: row.categories,
          description: row.description,
          websiteUrl: row.websiteUrl,
          facebookUrl: row.facebookUrl,
          ticketUrl: row.ticketUrl,
          vendorDetails: row.vendorDetails,
          parkingInfo: row.parkingInfo,
          loadInInfo: row.loadInInfo,
          venueNotes: row.venueNotes,
          flyerImageUrl: row.flyerImageUrl,
          lastVerifiedAt: new Date(),
          expiresAt: new Date(row.endDate.getTime() + 24 * 60 * 60 * 1000),
          venueId,
        },
      });
    }
  });

  await writeAuditLog({
    actorId: actor?.actorId ?? null,
    actorRole: actor?.actorRole ?? null,
    action: "shows.bulk_imported",
    targetType: "Show",
    details: {
      created: preparedRows.length,
      skipped: errors.length,
      rows: rows.length,
    },
  });

  return {
    created: preparedRows.length,
    skipped: errors.length,
    errors,
  };
}

export async function getRecentAdminShows(limit = 10) {
  if (isFixtureMode()) {
    return (await getAllFixtureShows())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  return db.show.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      city: true,
      state: true,
      startDate: true,
      endDate: true,
      lastVerifiedAt: true,
      createdAt: true,
    },
  });
}

export async function getAdminShows({
  status,
  stale,
  q,
  limit = 30,
  offset = 0,
}: {
  status?: string;
  stale?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const query = q?.trim().toLowerCase();

  if (isFixtureMode()) {
    let shows = await getAllFixtureShows();

    if (status) {
      shows = shows.filter((show) => show.status === status);
    }

    if (stale) {
      shows = shows.filter(
        (show) =>
          show.status === "APPROVED" &&
          (!show.lastVerifiedAt || show.lastVerifiedAt < staleDate)
      );
    }

    if (query) {
      shows = shows.filter((show) => {
        const haystack = [
          show.title,
          show.slug,
          show.city,
          show.state,
          show.organizer?.name ?? "",
          show.organizer?.email ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    }

    shows = shows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      shows: shows.slice(offset, offset + limit),
      total: shows.length,
    };
  }

  const where: any = {};
  if (status) where.status = status;
  if (stale) {
    where.status = "APPROVED";
    where.OR = [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: staleDate } }];
  }
  if (query) {
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { state: { equals: query.toUpperCase() } },
          { organizer: { is: { name: { contains: query, mode: "insensitive" } } } },
          { organizer: { is: { email: { contains: query, mode: "insensitive" } } } },
        ],
      },
    ];
  }

  const [shows, total] = await Promise.all([
    db.show.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        status: true,
        city: true,
        state: true,
        startDate: true,
        endDate: true,
        lastVerifiedAt: true,
        slug: true,
        sourceType: true,
        organizer: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    db.show.count({ where }),
  ]);

  return { shows, total };
}

export async function getNearbyShows({
  lat,
  lng,
  radiusMiles = 100,
  limit = 48,
}: {
  lat: number;
  lng: number;
  radiusMiles?: number;
  limit?: number;
}) {
  if (isFixtureMode()) {
    return (await filterFixtureShows({}))
      .sort(sortShows)
      .slice(0, limit)
      .map(projectShowCard);
  }

  const today = startOfToday();

  type NearbyRow = {
    id: string;
    title: string;
    slug: string;
    city: string;
    state: string;
    startDate: Date;
    endDate: Date;
    startTimeLabel: string | null;
    endTimeLabel: string | null;
    isFree: boolean;
    admissionPrice: string | null;
    categories: string[];
    flyerImageUrl: string | null;
    tableCount: bigint | null;
    vendorDetails: string | null;
    featuredRank: bigint | null;
    venueName: string | null;
    distanceMiles: unknown;
  };

  const rows = await db.$queryRaw<NearbyRow[]>`
    SELECT
      s.id,
      s.title,
      s.slug,
      s.city,
      s.state,
      s."startDate",
      s."endDate",
      s."startTimeLabel",
      s."endTimeLabel",
      s."isFree",
      s."admissionPrice",
      s.categories,
      s."flyerImageUrl",
      s."tableCount",
      s."vendorDetails",
      s."featuredRank",
      v.name AS "venueName",
      ROUND(
        (3959.0 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(${lat})) * cos(radians(v.latitude)) *
            cos(radians(v.longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(v.latitude))
          ))
        ))::numeric, 1
      ) AS "distanceMiles"
    FROM "Show" s
    JOIN "Venue" v ON s."venueId" = v.id
    WHERE s.status = 'APPROVED'
      AND s."startDate" >= ${today}
      AND (s."expiresAt" IS NULL OR s."expiresAt" >= ${today})
      AND v.latitude IS NOT NULL
      AND v.longitude IS NOT NULL
      AND (3959.0 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(${lat})) * cos(radians(v.latitude)) *
          cos(radians(v.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(v.latitude))
        ))
      )) <= ${radiusMiles}
    ORDER BY
      COALESCE(s."featuredRank", 2147483647) ASC,
      s."startDate" ASC,
      CASE WHEN s.state = 'KS' THEN 0 ELSE 1 END ASC,
      s.state ASC,
      s.city ASC,
      s.title ASC
    LIMIT ${limit}
  `;

  const venueResults = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    city: row.city,
    state: row.state,
    startDate: row.startDate,
    endDate: row.endDate,
    startTimeLabel: row.startTimeLabel,
    endTimeLabel: row.endTimeLabel,
    isFree: row.isFree,
    admissionPrice: row.admissionPrice,
    categories: row.categories,
    flyerImageUrl: row.flyerImageUrl,
    tableCount: row.tableCount !== null ? Number(row.tableCount) : null,
    vendorDetails: row.vendorDetails,
    featuredRank: row.featuredRank !== null ? Number(row.featuredRank) : null,
    venue: row.venueName ? { name: row.venueName } : null,
    distanceMiles: parseFloat(String(row.distanceMiles)),
  }));

  // Fallback: shows without venue coords — use city-level coordinates
  const venueResultIds = new Set(venueResults.map((s) => s.id));

  const noCoordShows = await db.show.findMany({
    where: {
      ...upcomingWhere(),
      OR: [
        { venueId: null },
        { venue: { latitude: null } },
        { venue: { longitude: null } },
      ],
    },
    select: { ...showCardSelect, id: true },
  });

  function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const cityFallback = noCoordShows
    .filter((s) => !venueResultIds.has(s.id))
    .flatMap((s) => {
      const coords = getCityCoords(s.city, s.state);
      if (!coords) return [];
      const dist = haversine(lat, lng, coords.lat, coords.lng);
      if (dist > radiusMiles) return [];
      return [{ ...s, distanceMiles: Math.round(dist * 10) / 10 }];
    });

  return [...venueResults, ...cityFallback]
    .sort(sortShows)
    .slice(0, limit);
}

export async function getAdminShowById(id: string) {
  if (isFixtureMode()) {
    return getFixtureShowById(id);
  }

  return db.show.findUnique({
    where: { id },
    include: { venue: true, organizer: true, tags: true },
  });
}

export async function assignShowToPromoterByEmail(
  showId: string,
  email: string,
  actor?: {
    actorId?: string | null;
    actorRole?: UserRole | null;
  }
) {
  if (actor?.actorRole !== "ADMIN") {
    throw new Error("Only admins can assign shows to promoters.");
  }

  if (isFixtureMode()) {
    return { success: false, reason: "fixture-mode" as const };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: false, reason: "missing-email" as const };
  }

  const organizer = await db.organizer.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedEmail, mode: "insensitive" } },
        { user: { is: { email: { equals: normalizedEmail, mode: "insensitive" } } } },
      ],
    },
    select: { id: true },
  });

  if (!organizer) {
    return { success: false, reason: "not-found" as const };
  }

  await db.show.update({
    where: { id: showId },
    data: { organizerId: organizer.id },
  });

  await writeAuditLog({
    actorId: actor?.actorId ?? null,
    actorRole: actor?.actorRole ?? null,
    action: "show.promoter_assigned",
    targetType: "Show",
    targetId: showId,
    details: {
      organizerId: organizer.id,
      email: normalizedEmail,
    },
  });

  return { success: true as const, reason: null };
}

export async function clearShowPromoterAssignment(
  showId: string,
  actor?: {
    actorId?: string | null;
    actorRole?: UserRole | null;
  }
) {
  if (actor?.actorRole !== "ADMIN") {
    throw new Error("Only admins can clear promoter assignments.");
  }

  if (isFixtureMode()) {
    return;
  }

  await db.show.update({
    where: { id: showId },
    data: { organizerId: null },
  });

  await writeAuditLog({
    actorId: actor?.actorId ?? null,
    actorRole: actor?.actorRole ?? null,
    action: "show.promoter_cleared",
    targetType: "Show",
    targetId: showId,
  });
}

export async function updateAdminShowDetails(
  showId: string,
  input: AdminShowUpdateInput,
  actor?: {
    actorId?: string | null;
    actorRole?: UserRole | null;
  }
) {
  if (actor?.actorRole !== "ADMIN") {
    throw new Error("Only admins can edit shows.");
  }

  if (isFixtureMode()) {
    return { success: false as const, reason: "fixture-mode" as const };
  }

  const title = normalizeCsvString(input.title);
  const city = normalizeCsvString(input.city);
  const state = normalizeCsvString(input.state)?.toUpperCase() ?? null;
  const startDate = parseDateInput(normalizeCsvString(input.startDate));
  const endDate = parseDateInput(normalizeCsvString(input.endDate));
  const tableCount = parseOptionalInteger(normalizeCsvString(input.tableCount ?? undefined));
  const estimatedAttendance = parseOptionalInteger(
    normalizeCsvString(input.estimatedAttendance ?? undefined)
  );
  const venueName = normalizeCsvString(input.venueName ?? undefined);
  const venueAddress1 = normalizeCsvString(input.venueAddress1 ?? undefined);
  const venueAddress2 = normalizeCsvString(input.venueAddress2 ?? undefined);
  const venuePostalCode = normalizeCsvString(input.venuePostalCode ?? undefined);

  if (!title || !city || !state || !startDate || !endDate) {
    return { success: false as const, reason: "validation" as const };
  }

  if (!/^[A-Z]{2}$/.test(state) || endDate < startDate) {
    return { success: false as const, reason: "validation" as const };
  }

  if (tableCount.error || estimatedAttendance.error) {
    return { success: false as const, reason: "validation" as const };
  }

  const existingShow = await db.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      venueId: true,
      title: true,
      city: true,
      state: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!existingShow) {
    return { success: false as const, reason: "not-found" as const };
  }

  let flyerImageUrl: string | null = null;

  try {
    flyerImageUrl = await resolveManagedFlyerImageUrl(
      title,
      normalizeCsvString(input.flyerImageUrl ?? undefined)
    );
  } catch {
    return { success: false as const, reason: "validation" as const };
  }

  let venueId: string | null = null;

  if (venueName) {
    const venue = await db.venue.upsert({
      where: {
        name_city_state: {
          name: venueName,
          city,
          state,
        },
      },
      create: {
        name: venueName,
        address1: venueAddress1 ?? "Address unavailable",
        address2: venueAddress2,
        city,
        state,
        postalCode: venuePostalCode,
        parkingInfo: normalizeCsvString(input.parkingInfo ?? undefined),
        loadInInfo: normalizeCsvString(input.loadInInfo ?? undefined),
      },
      update: {
        address1: venueAddress1 ?? undefined,
        address2: venueAddress2 ?? undefined,
        postalCode: venuePostalCode ?? undefined,
        parkingInfo: normalizeCsvString(input.parkingInfo ?? undefined) ?? undefined,
        loadInInfo: normalizeCsvString(input.loadInInfo ?? undefined) ?? undefined,
      },
    });

    venueId = venue.id;
  }

  const show = await db.show.update({
    where: { id: showId },
    data: {
      title,
      city,
      state,
      startDate,
      endDate,
      startTimeLabel: normalizeCsvString(input.startTimeLabel ?? undefined),
      endTimeLabel: normalizeCsvString(input.endTimeLabel ?? undefined),
      isFree: input.isFree,
      admissionPrice: normalizeCsvString(input.admissionPrice ?? undefined),
      admissionNotes: normalizeCsvString(input.admissionNotes ?? undefined),
      tableCount: tableCount.value,
      estimatedAttendance: estimatedAttendance.value,
      categories: parseCategories(normalizeCsvString(input.categories ?? undefined)),
      description: normalizeCsvString(input.description ?? undefined),
      websiteUrl: normalizeExternalUrl(input.websiteUrl),
      facebookUrl: normalizeExternalUrl(input.facebookUrl),
      ticketUrl: normalizeExternalUrl(input.ticketUrl),
      vendorDetails: normalizeCsvString(input.vendorDetails ?? undefined),
      parkingInfo: normalizeCsvString(input.parkingInfo ?? undefined),
      loadInInfo: normalizeCsvString(input.loadInInfo ?? undefined),
      venueNotes: normalizeCsvString(input.venueNotes ?? undefined),
      flyerImageUrl,
      expiresAt: new Date(endDate.getTime() + 24 * 60 * 60 * 1000),
      venueId,
    },
  });

  await writeAuditLog({
    actorId: actor?.actorId ?? null,
    actorRole: actor?.actorRole ?? null,
    action: "show.edited",
    targetType: "Show",
    targetId: showId,
    details: {
      previousTitle: existingShow.title,
      nextTitle: show.title,
      previousCity: existingShow.city,
      nextCity: show.city,
      previousState: existingShow.state,
      nextState: show.state,
      previousStartDate: existingShow.startDate.toISOString(),
      nextStartDate: show.startDate.toISOString(),
      previousEndDate: existingShow.endDate.toISOString(),
      nextEndDate: show.endDate.toISOString(),
      previousVenueId: existingShow.venueId,
      nextVenueId: show.venueId,
    },
  });

  return { success: true as const, reason: null };
}

export async function ensureManagedShowFlyerImage(
  showId: string,
  title: string,
  flyerImageUrl: string | null
) {
  if (isFixtureMode() || !flyerImageUrl) {
    return flyerImageUrl;
  }

  try {
    const managedFlyerImageUrl = await resolveManagedFlyerImageUrl(title, flyerImageUrl);
    if (!managedFlyerImageUrl || managedFlyerImageUrl === flyerImageUrl) {
      return flyerImageUrl;
    }

    await db.show.update({
      where: { id: showId },
      data: { flyerImageUrl: managedFlyerImageUrl },
    });

    return managedFlyerImageUrl;
  } catch {
    return flyerImageUrl;
  }
}
