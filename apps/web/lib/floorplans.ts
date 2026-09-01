import type { Prisma } from "@csn/db";
import { db } from "@/lib/db";
import type { DocumentSlice } from "@floorplanner/lib/persistence";
import { validateDocumentSlice } from "@floorplanner/lib/document-schema";
import { assertDocumentLimits } from "@floorplanner/lib/document-limits";

export type ShowFloorplanSummary = {
  id: string;
  name: string;
  savedAt: string;
  revision: number;
  tableCount: number;
  vendorCount: number;
};

export type ShowFloorplanRecord = ShowFloorplanSummary & {
  data: DocumentSlice;
};

export const MAX_SHOW_FLOORPLANS_PER_SHOW = 10;

export class ShowFloorplanRevisionConflictError extends Error {
  currentLayout: ShowFloorplanSummary | null;

  constructor(message: string, currentLayout: ShowFloorplanSummary | null) {
    super(message);
    this.name = "ShowFloorplanRevisionConflictError";
    this.currentLayout = currentLayout;
  }
}

export class ShowFloorplanQuotaError extends Error {
  limit: number;

  constructor(limit: number) {
    super(`This show has reached the cloud floorplan limit (${limit}). Delete an old floorplan before saving a new one.`);
    this.name = "ShowFloorplanQuotaError";
    this.limit = limit;
  }
}

function toSummary(row: {
  id: string;
  name: string;
  updatedAt: Date;
  revision: number;
  tableCount: number;
  vendorCount: number;
}): ShowFloorplanSummary {
  return {
    id: row.id,
    name: row.name,
    savedAt: row.updatedAt.toISOString(),
    revision: row.revision,
    tableCount: row.tableCount,
    vendorCount: row.vendorCount,
  };
}

export async function listShowFloorplans(showId: string): Promise<ShowFloorplanSummary[]> {
  const rows = await db.showFloorplan.findMany({
    where: { showId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      updatedAt: true,
      revision: true,
      tableCount: true,
      vendorCount: true,
    },
  });

  return rows.map(toSummary);
}

export async function getLatestShowFloorplan(showId: string): Promise<ShowFloorplanRecord | null> {
  const row = await db.showFloorplan.findFirst({
    where: { showId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      dataJson: true,
      updatedAt: true,
      revision: true,
      tableCount: true,
      vendorCount: true,
    },
  });

  if (!row) {
    return null;
  }

  return {
    ...toSummary(row),
    data: asDocumentSlice(row.dataJson),
  };
}

export async function getShowFloorplan(showId: string, id: string): Promise<ShowFloorplanRecord | null> {
  const row = await db.showFloorplan.findFirst({
    where: { id, showId },
    select: {
      id: true,
      name: true,
      dataJson: true,
      updatedAt: true,
      revision: true,
      tableCount: true,
      vendorCount: true,
    },
  });

  if (!row) {
    return null;
  }

  return {
    ...toSummary(row),
    data: asDocumentSlice(row.dataJson),
  };
}

export async function saveShowFloorplan(input: {
  id?: string | null;
  showId: string;
  venueId?: string | null;
  name: string;
  data: DocumentSlice;
  actorUserId: string;
  expectedRevision?: number | null;
}): Promise<ShowFloorplanSummary> {
  const normalizedName = input.name.trim() || "Floor Plan";
  const tableCount = Object.keys(input.data.tables).length;
  const vendorCount = Object.keys(input.data.vendors).length;

  if (input.id) {
    if (input.expectedRevision == null) {
      const current = await getShowFloorplanSummary(input.showId, input.id);
      throw new ShowFloorplanRevisionConflictError(
        "A revision is required to overwrite this floorplan. Reload it before saving again.",
        current,
      );
    }

    const updated = await db.showFloorplan.updateMany({
      where: {
        id: input.id,
        showId: input.showId,
        revision: input.expectedRevision,
      },
      data: {
        name: normalizedName,
        dataJson: asInputJsonValue(input.data),
        revision: { increment: 1 },
        tableCount,
        vendorCount,
        venueId: input.venueId ?? null,
        updatedById: input.actorUserId,
      },
    });

    if (updated.count !== 1) {
      const current = await getShowFloorplanSummary(input.showId, input.id);
      throw new ShowFloorplanRevisionConflictError(
        "This floorplan changed on the server. Reload it before saving again.",
        current,
      );
    }

    const saved = await getShowFloorplanSummary(input.showId, input.id);
    if (!saved) throw new Error("Floorplan disappeared after it was saved.");
    return saved;
  }

  return db.$transaction(async (tx) => {
    // Serialize creates for one show so concurrent requests cannot both pass
    // the quota check. The lock is released automatically with the transaction.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`floorplanner-show:${input.showId}`}, 0))`;

    const existingByName = await tx.showFloorplan.findFirst({
      where: { showId: input.showId, name: normalizedName },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        revision: true,
        tableCount: true,
        vendorCount: true,
      },
    });
    if (existingByName) {
      throw new ShowFloorplanRevisionConflictError(
        "A floorplan with this name already exists. Load it before overwriting it.",
        toSummary(existingByName),
      );
    }

    const currentCount = await tx.showFloorplan.count({
      where: { showId: input.showId },
    });
    if (currentCount >= MAX_SHOW_FLOORPLANS_PER_SHOW) {
      throw new ShowFloorplanQuotaError(MAX_SHOW_FLOORPLANS_PER_SHOW);
    }

    const saved = await tx.showFloorplan.create({
      data: {
        showId: input.showId,
        venueId: input.venueId ?? null,
        name: normalizedName,
        dataJson: asInputJsonValue(input.data),
        tableCount,
        vendorCount,
        createdById: input.actorUserId,
        updatedById: input.actorUserId,
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        revision: true,
        tableCount: true,
        vendorCount: true,
      },
    });

    return toSummary(saved);
  });
}

export async function deleteShowFloorplan(showId: string, id: string): Promise<void> {
  await db.showFloorplan.deleteMany({
    where: { showId, id },
  });
}

async function getShowFloorplanSummary(
  showId: string,
  id: string,
): Promise<ShowFloorplanSummary | null> {
  const row = await db.showFloorplan.findFirst({
    where: { id, showId },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      revision: true,
      tableCount: true,
      vendorCount: true,
    },
  });
  return row ? toSummary(row) : null;
}
function asDocumentSlice(value: Prisma.JsonValue): DocumentSlice {
  const data = validateDocumentSlice(value);
  assertDocumentLimits(data);
  return data;
}

function asInputJsonValue(value: DocumentSlice): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
