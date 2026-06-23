import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { saveFlyerImage } from "@/lib/flyers";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { createApprovedShowFromPayload, createShowSubmission } from "@/lib/submissions";
import { SHOW_CATEGORIES } from "@/lib/shows";
import { hasOrganizerFloorplanEnabledColumn } from "@/lib/organizer-schema";
import { normalizeExternalUrl } from "@/lib/url";

type RegisterPromoterInput = {
  email: string;
  password: string;
  contactName: string;
  organizerName: string;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
};

type PromoterShowInput = {
  showName: string;
  startDate: string;
  endDate: string;
  sameTimesEachDay?: boolean;
  dailySchedule?: Array<{
    date: string;
    startTimeLabel: string;
    endTimeLabel: string;
  }> | null;
  startTimeLabel?: string | null;
  endTimeLabel?: string | null;
  city: string;
  state: string;
  venueName: string;
  venueAddress?: string | null;
  categories: string[];
  description?: string | null;
  tableCount?: string | null;
  vendorDetails?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  isFree: boolean;
  admissionPrice?: string | null;
  admissionNotes?: string | null;
  parkingInfo?: string | null;
  flyerFile?: File | null;
};

export type PromoterShowDefaults = {
  showName: string;
  startDate: string;
  endDate: string;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  city: string;
  state: string;
  venueName: string;
  venueAddress: string | null;
  categories: string[];
  description: string | null;
  tableCount: string | null;
  vendorDetails: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  isFree: boolean;
  admissionPrice: string | null;
  admissionNotes: string | null;
  parkingInfo: string | null;
};

export type PromoterBulkCsvRow = {
  rowNumber: number;
  title?: string;
  startDate?: string;
  endDate?: string;
  startTimeLabel?: string;
  endTimeLabel?: string;
  city?: string;
  state?: string;
  venueName?: string;
  venueAddress?: string;
  categories?: string;
  description?: string;
  tableCount?: string;
  vendorDetails?: string;
  websiteUrl?: string;
  facebookUrl?: string;
  isFree?: string;
  admissionPrice?: string;
  admissionNotes?: string;
  parkingInfo?: string;
};

export type PromoterBulkUploadResult = {
  approved: number;
  pending: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

const promoterCategoryAliases: Record<string, string> = {
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

function normalizeLocationValue(value: string) {
  return value.trim();
}

function normalizePromoterCsvString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parsePromoterDateInput(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePromoterOptionalInteger(value: string | null) {
  if (!value) return { value: null as string | null, error: null as string | null };
  if (!/^\d+$/.test(value)) {
    return { value: null, error: "must be a whole number" };
  }

  return { value, error: null };
}

function parsePromoterCategories(value: string | null) {
  if (!value) return { value: [] as string[], invalid: [] as string[] };

  const normalized = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => promoterCategoryAliases[item.toLowerCase()] ?? item);

  const valid = normalized.filter((item) =>
    SHOW_CATEGORIES.includes(item as (typeof SHOW_CATEGORIES)[number])
  );
  const invalid = normalized.filter((item) => !valid.includes(item));

  return { value: valid, invalid };
}

function buildPromoterDuplicateKey(input: {
  title: string;
  startDate: string;
  city: string;
  state: string;
}) {
  return [
    input.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""),
    input.startDate,
    input.city.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""),
    input.state.trim().toUpperCase(),
  ].join("|");
}

export async function registerPromoterAccount(input: RegisterPromoterInput) {
  const email = input.email.trim().toLowerCase();
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("An account already exists for that email.");
  }

  const passwordHash = await hashPassword(input.password);

  // If an organizer record already exists for this email (e.g. created from a
  // show submission), link the new user to it rather than creating a duplicate.
  const existingOrganizer = await db.organizer.findFirst({
    where: { email, userId: null },
    select: { id: true },
  });

  if (existingOrganizer) {
    const user = await db.user.create({
      data: {
        name: input.contactName,
        email,
        passwordHash,
        role: "ORGANIZER",
      },
    });
    await db.organizer.update({
      where: { id: existingOrganizer.id },
      data: {
        userId: user.id,
        name: input.organizerName,
        websiteUrl: normalizeExternalUrl(input.websiteUrl),
        facebookUrl: normalizeExternalUrl(input.facebookUrl),
        instagramUrl: normalizeExternalUrl(input.instagramUrl),
      },
    });
    return user;
  }

  const user = await db.user.create({
    data: {
      name: input.contactName,
      email,
      passwordHash,
      role: "ORGANIZER",
      organizer: {
        create: {
          name: input.organizerName,
          email,
          websiteUrl: normalizeExternalUrl(input.websiteUrl),
          facebookUrl: normalizeExternalUrl(input.facebookUrl),
          instagramUrl: normalizeExternalUrl(input.instagramUrl),
        },
      },
    },
  });

  return user;
}

export async function authenticatePromoter(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      emailVerifiedAt: true,
      sessionVersion: true,
      organizer: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user?.organizer || user.role !== "ORGANIZER") {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return user;
}

export async function getPromoterDashboardData(userId: string) {
  const hasFloorplanEnabledColumn = await hasOrganizerFloorplanEnabledColumn();
  const user = hasFloorplanEnabledColumn
    ? await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerifiedAt: true,
          organizer: {
            select: {
              id: true,
              name: true,
              email: true,
              websiteUrl: true,
              facebookUrl: true,
              instagramUrl: true,
              verified: true,
              floorplanEnabled: true,
              approvals: {
                where: { autoApprove: true },
                orderBy: [{ state: "asc" }, { city: "asc" }],
              },
              shows: {
                orderBy: [{ startDate: "desc" }],
                take: 20,
              },
            },
          },
        },
      })
    : await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerifiedAt: true,
          organizer: {
            select: {
              id: true,
              name: true,
              email: true,
              websiteUrl: true,
              facebookUrl: true,
              instagramUrl: true,
              verified: true,
              approvals: {
                where: { autoApprove: true },
                orderBy: [{ state: "asc" }, { city: "asc" }],
              },
              shows: {
                orderBy: [{ startDate: "desc" }],
                take: 20,
              },
            },
          },
        },
      });

  if (!user?.organizer) {
    return null;
  }

  const showCount = await db.show.count({
    where: { organizerId: user.organizer.id },
  });

  return {
    user,
    organizer: {
      ...user.organizer,
      floorplanEnabled:
        hasFloorplanEnabledColumn && "floorplanEnabled" in user.organizer
          ? user.organizer.floorplanEnabled
          : false,
    },
    approvals: user.organizer.approvals,
    shows: user.organizer.shows,
    showCount,
  };
}

export async function getPromoterShowDefaults(userId: string, showId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      organizer: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user?.organizer) {
    return null;
  }

  const show = await db.show.findFirst({
    where: {
      id: showId,
      organizerId: user.organizer.id,
    },
    include: {
      venue: true,
    },
  });

  if (!show) {
    return null;
  }

  return {
    showName: show.title,
    startDate: show.startDate.toISOString().slice(0, 10),
    endDate: show.endDate.toISOString().slice(0, 10),
    startTimeLabel: show.startTimeLabel,
    endTimeLabel: show.endTimeLabel,
    city: show.city,
    state: show.state,
    venueName: show.venue?.name ?? "",
    venueAddress: show.venue?.address1 ?? null,
    categories: show.categories,
    description: show.description,
    tableCount: show.tableCount?.toString() ?? null,
    vendorDetails: show.vendorDetails,
    websiteUrl: show.websiteUrl,
    facebookUrl: show.facebookUrl,
    isFree: show.isFree,
    admissionPrice: show.admissionPrice,
    admissionNotes: show.admissionNotes,
    parkingInfo: show.parkingInfo,
  } satisfies PromoterShowDefaults;
}

export async function createPromoterShow(userId: string, input: PromoterShowInput) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      organizer: {
        select: {
          id: true,
          name: true,
          email: true,
          websiteUrl: true,
          facebookUrl: true,
        },
      },
    },
  });

  if (!user?.organizer) {
    throw new Error("Organizer account not found.");
  }

  const organizer = user.organizer;
  const city = normalizeLocationValue(input.city);
  const state = normalizeLocationValue(input.state).toUpperCase();
  const flyerImageUrl =
    input.flyerFile && input.flyerFile.size > 0
      ? await saveFlyerImage(input.showName, input.flyerFile)
      : null;

  const payload: Record<string, unknown> = {
    showName: input.showName,
    startDate: input.startDate,
    endDate: input.endDate,
    sameTimesEachDay: input.sameTimesEachDay !== false,
    dailySchedule: input.dailySchedule ?? null,
    startTimeLabel: input.startTimeLabel ?? null,
    endTimeLabel: input.endTimeLabel ?? null,
    city,
    state,
    venueName: input.venueName,
    venueAddress: input.venueAddress ?? null,
    categories: input.categories,
    organizerId: organizer.id,
    organizerName: organizer.name,
    organizerEmail: organizer.email,
    description: input.description ?? null,
    tableCount: input.tableCount ?? null,
    vendorDetails: input.vendorDetails ?? null,
    websiteUrl: normalizeExternalUrl(input.websiteUrl) ?? organizer.websiteUrl,
    facebookUrl: normalizeExternalUrl(input.facebookUrl) ?? organizer.facebookUrl,
    isFree: input.isFree,
    admissionPrice: input.admissionPrice ?? null,
    admissionNotes: input.admissionNotes ?? null,
    parkingInfo: input.parkingInfo ?? null,
    flyerImageUrl,
    submittedViaPortal: true,
  };

  const approval = await db.organizerApproval.findUnique({
    where: {
      organizerId_city_state: {
        organizerId: organizer.id,
        city,
        state,
      },
    },
  });

  const nextApprovedCount = (approval?.approvedShowCount ?? 0) + 1;
  const needsSpotCheck =
    Boolean(approval?.autoApprove) &&
    nextApprovedCount % Math.max(approval?.reviewEvery ?? 4, 1) === 0;

  if (approval?.autoApprove && !needsSpotCheck) {
    const show = await createApprovedShowFromPayload(payload);
    await db.organizerApproval.update({
      where: { id: approval.id },
      data: { approvedShowCount: { increment: 1 } },
    });

    return {
      status: "APPROVED" as const,
      show,
      territoryStatus: "trusted",
    };
  }

  const submission = await createShowSubmission({
    submitterName: user.name ?? organizer.name,
    submitterEmail: user.email,
    payloadJson: payload,
  });

  return {
    status: "PENDING" as const,
    submission,
    territoryStatus: approval?.autoApprove ? "spot-check" : "review",
  };
}

export async function bulkCreatePromoterShows(
  userId: string,
  rows: PromoterBulkCsvRow[],
): Promise<PromoterBulkUploadResult> {
  if (isFixtureMode()) {
    return {
      approved: 0,
      pending: 0,
      skipped: rows.length,
      errors: rows.map((row) => ({
        row: row.rowNumber,
        message: "Bulk upload is unavailable in fixture mode.",
      })),
    };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      organizer: {
        select: {
          id: true,
          name: true,
          email: true,
          websiteUrl: true,
          facebookUrl: true,
        },
      },
    },
  });

  if (!user?.organizer) {
    throw new Error("Organizer account not found.");
  }

  const errors: PromoterBulkUploadResult["errors"] = [];
  const validRows: Array<{
    rowNumber: number;
    showName: string;
    startDate: string;
    endDate: string;
    startTimeLabel: string | null;
    endTimeLabel: string | null;
    city: string;
    state: string;
    venueName: string;
    venueAddress: string | null;
    categories: string[];
    description: string | null;
    tableCount: string | null;
    vendorDetails: string | null;
    websiteUrl: string | null;
    facebookUrl: string | null;
    isFree: boolean;
    admissionPrice: string | null;
    admissionNotes: string | null;
    parkingInfo: string | null;
  }> = [];

  for (const row of rows) {
    const showName = normalizePromoterCsvString(row.title);
    const startDateValue = normalizePromoterCsvString(row.startDate);
    const endDateValue = normalizePromoterCsvString(row.endDate) ?? startDateValue;
    const city = normalizePromoterCsvString(row.city);
    const state = normalizePromoterCsvString(row.state)?.toUpperCase() ?? null;
    const venueName = normalizePromoterCsvString(row.venueName);
    const startDate = parsePromoterDateInput(startDateValue);
    const endDate = parsePromoterDateInput(endDateValue);
    const categories = parsePromoterCategories(normalizePromoterCsvString(row.categories));
    const tableCount = parsePromoterOptionalInteger(normalizePromoterCsvString(row.tableCount));
    const websiteUrlInput = normalizePromoterCsvString(row.websiteUrl);
    const facebookUrlInput = normalizePromoterCsvString(row.facebookUrl);
    const websiteUrl = normalizeExternalUrl(websiteUrlInput);
    const facebookUrl = normalizeExternalUrl(facebookUrlInput);

    if (!showName || !startDateValue || !endDateValue || !city || !state || !venueName) {
      errors.push({
        row: row.rowNumber,
        message: "Missing required fields. Required: title, startDate, endDate, city, state, venueName.",
      });
      continue;
    }

    if (!startDate || !endDate || endDate < startDate) {
      errors.push({
        row: row.rowNumber,
        message: "Dates must use YYYY-MM-DD format and endDate cannot be before startDate.",
      });
      continue;
    }

    if (!/^[A-Z]{2}$/.test(state)) {
      errors.push({
        row: row.rowNumber,
        message: "State must be a 2-letter code.",
      });
      continue;
    }

    if (categories.invalid.length > 0) {
      errors.push({
        row: row.rowNumber,
        message: `Invalid categories: ${categories.invalid.join(", ")}.`,
      });
      continue;
    }

    if (tableCount.error) {
      errors.push({
        row: row.rowNumber,
        message: `tableCount ${tableCount.error}.`,
      });
      continue;
    }

    if (websiteUrlInput && !websiteUrl) {
      errors.push({
        row: row.rowNumber,
        message: "websiteUrl must be a valid http or https URL.",
      });
      continue;
    }

    if (facebookUrlInput && !facebookUrl) {
      errors.push({
        row: row.rowNumber,
        message: "facebookUrl must be a valid http or https URL.",
      });
      continue;
    }

    validRows.push({
      rowNumber: row.rowNumber,
      showName,
      startDate: startDateValue,
      endDate: endDateValue,
      startTimeLabel: normalizePromoterCsvString(row.startTimeLabel),
      endTimeLabel: normalizePromoterCsvString(row.endTimeLabel),
      city,
      state,
      venueName,
      venueAddress: normalizePromoterCsvString(row.venueAddress),
      categories: categories.value,
      description: normalizePromoterCsvString(row.description),
      tableCount: tableCount.value,
      vendorDetails: normalizePromoterCsvString(row.vendorDetails),
      websiteUrl,
      facebookUrl,
      isFree: normalizePromoterCsvString(row.isFree)?.toLowerCase() === "yes",
      admissionPrice: normalizePromoterCsvString(row.admissionPrice),
      admissionNotes: normalizePromoterCsvString(row.admissionNotes),
      parkingInfo: normalizePromoterCsvString(row.parkingInfo),
    });
  }

  const duplicateKeys = new Set<string>();
  const dedupedRows: typeof validRows = [];

  for (const row of validRows) {
    const key = buildPromoterDuplicateKey({
      title: row.showName,
      startDate: row.startDate,
      city: row.city,
      state: row.state,
    });

    if (duplicateKeys.has(key)) {
      errors.push({
        row: row.rowNumber,
        message: "Duplicate row in upload (same title, start date, city, and state).",
      });
      continue;
    }

    duplicateKeys.add(key);
    dedupedRows.push(row);
  }

  const existingShows = await db.show.findMany({
    where: {
      organizerId: user.organizer.id,
    },
    select: {
      title: true,
      city: true,
      state: true,
      startDate: true,
    },
  });

  const existingSubmissions = await db.showSubmission.findMany({
    where: {
      submitterEmail: user.email,
      status: "PENDING",
    },
    select: {
      payloadJson: true,
    },
  });

  const existingKeys = new Set<string>();
  for (const show of existingShows) {
    existingKeys.add(
      buildPromoterDuplicateKey({
        title: show.title,
        startDate: show.startDate.toISOString().slice(0, 10),
        city: show.city,
        state: show.state,
      }),
    );
  }

  for (const submission of existingSubmissions) {
    const payload = submission.payloadJson as Record<string, unknown>;
    const title = typeof payload.showName === "string" ? payload.showName : null;
    const startDate = typeof payload.startDate === "string" ? payload.startDate : null;
    const city = typeof payload.city === "string" ? payload.city : null;
    const state = typeof payload.state === "string" ? payload.state : null;
    if (!title || !startDate || !city || !state) continue;

    existingKeys.add(buildPromoterDuplicateKey({ title, startDate, city, state }));
  }

  let approved = 0;
  let pending = 0;

  for (const row of dedupedRows) {
    const key = buildPromoterDuplicateKey({
      title: row.showName,
      startDate: row.startDate,
      city: row.city,
      state: row.state,
    });

    if (existingKeys.has(key)) {
      errors.push({
        row: row.rowNumber,
        message: "A matching show or pending submission already exists for this account.",
      });
      continue;
    }

    const result = await createPromoterShow(userId, {
      showName: row.showName,
      startDate: row.startDate,
      endDate: row.endDate,
      startTimeLabel: row.startTimeLabel,
      endTimeLabel: row.endTimeLabel,
      city: row.city,
      state: row.state,
      venueName: row.venueName,
      venueAddress: row.venueAddress,
      categories: row.categories,
      description: row.description,
      tableCount: row.tableCount,
      vendorDetails: row.vendorDetails,
      websiteUrl: row.websiteUrl,
      facebookUrl: row.facebookUrl,
      isFree: row.isFree,
      admissionPrice: row.admissionPrice,
      admissionNotes: row.admissionNotes,
      parkingInfo: row.parkingInfo,
      flyerFile: null,
    });

    if (result.status === "APPROVED") {
      approved += 1;
    } else {
      pending += 1;
    }

    existingKeys.add(key);
  }

  return {
    approved,
    pending,
    skipped: errors.length,
    errors,
  };
}

export async function getAdminPromoters() {
  if (isFixtureMode()) {
    return [];
  }

  return db.organizer.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
      approvals: {
        orderBy: [{ state: "asc" }, { city: "asc" }],
      },
      _count: {
        select: {
          shows: true,
        },
      },
    },
    orderBy: [{ verified: "desc" }, { name: "asc" }],
  });
}

export async function getAdminPromoterById(organizerId: string) {
  if (isFixtureMode()) {
    return null;
  }

  return db.organizer.findUnique({
    where: { id: organizerId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          emailVerifiedAt: true,
        },
      },
      approvals: {
        orderBy: [{ state: "asc" }, { city: "asc" }],
      },
      shows: {
        orderBy: [{ startDate: "desc" }],
        take: 20,
        select: {
          id: true,
          title: true,
          slug: true,
          city: true,
          state: true,
          status: true,
          startDate: true,
          endDate: true,
          lastVerifiedAt: true,
        },
      },
      _count: {
        select: {
          shows: true,
        },
      },
    },
  });
}

export async function cleanupPromoterTestData() {
  const testUsers = await db.user.findMany({
    where: {
      email: {
        startsWith: "portal-test-",
      },
    },
    select: {
      id: true,
      email: true,
      organizer: {
        select: {
          id: true,
        },
      },
    },
  });

  const organizerIds = testUsers
    .map((user) => user.organizer?.id ?? null)
    .filter((id): id is string => Boolean(id));
  const emails = testUsers.map((user) => user.email);

  if (organizerIds.length > 0) {
    await db.organizerApproval.deleteMany({
      where: {
        organizerId: { in: organizerIds },
      },
    });

    await db.show.deleteMany({
      where: {
        organizerId: { in: organizerIds },
      },
    });

    await db.organizer.deleteMany({
      where: {
        id: { in: organizerIds },
      },
    });
  }

  if (emails.length > 0) {
    const deletedSubmissions = await db.showSubmission.deleteMany({
      where: {
        submitterEmail: { in: emails },
      },
    });

    const deletedUsers = await db.user.deleteMany({
      where: {
        id: { in: testUsers.map((user) => user.id) },
      },
    });

    const deletedVenues = await db.venue.deleteMany({
      where: {
        OR: [
          { name: { startsWith: "Test Venue " } },
          { address1: { startsWith: "123 Test" } },
          { address1: { startsWith: "456 Test" } },
        ],
      },
    });

    return {
      deletedUsers: deletedUsers.count,
      deletedOrganizers: organizerIds.length,
      deletedVenues: deletedVenues.count,
      deletedSubmissions: deletedSubmissions.count,
    };
  }

  return {
    deletedUsers: 0,
    deletedOrganizers: organizerIds.length,
    deletedVenues: 0,
    deletedSubmissions: 0,
  };
}
