import { db } from "@/lib/db";

const TCDB_CURSOR_SOURCE = "tcdb";
const TCDB_CURSOR_SCOPE = "state";
const MAX_SEEN_EXTERNAL_IDS = 5000;

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function mergeSeenExternalIds(existing: string[], incoming: string[], maxItems = MAX_SEEN_EXTERNAL_IDS) {
  return uniqueStrings([...incoming, ...existing]).slice(0, maxItems);
}

export async function getSeenTcdbExternalIdsByState(stateCodes: string[]) {
  const uniqueStateCodes = uniqueStrings(stateCodes);
  if (uniqueStateCodes.length === 0) {
    return new Map<string, Set<string>>();
  }

  const rows = await db.importCursor.findMany({
    where: {
      source: TCDB_CURSOR_SOURCE,
      scope: TCDB_CURSOR_SCOPE,
      cursorKey: { in: uniqueStateCodes },
    },
  });

  const result = new Map<string, Set<string>>();
  for (const stateCode of uniqueStateCodes) {
    result.set(stateCode, new Set<string>());
  }

  for (const row of rows) {
    result.set(row.cursorKey, new Set(row.seenExternalIds));
  }

  return result;
}

export async function updateSeenTcdbExternalIdsForState(stateCode: string, externalIds: string[]) {
  const nextSeenExternalIds = uniqueStrings(externalIds);

  const existing = await db.importCursor.findUnique({
    where: {
      source_scope_cursorKey: {
        source: TCDB_CURSOR_SOURCE,
        scope: TCDB_CURSOR_SCOPE,
        cursorKey: stateCode,
      },
    },
  });

  const mergedExternalIds = mergeSeenExternalIds(existing?.seenExternalIds ?? [], nextSeenExternalIds);

  await db.importCursor.upsert({
    where: {
      source_scope_cursorKey: {
        source: TCDB_CURSOR_SOURCE,
        scope: TCDB_CURSOR_SCOPE,
        cursorKey: stateCode,
      },
    },
    create: {
      source: TCDB_CURSOR_SOURCE,
      scope: TCDB_CURSOR_SCOPE,
      cursorKey: stateCode,
      seenExternalIds: mergedExternalIds,
    },
    update: {
      seenExternalIds: mergedExternalIds,
    },
  });
}
