import { runEventbriteImport } from "@/lib/eventbrite-import";
import { runTcdbImport } from "@/lib/tcdb-import";
import { getAllTcdbImportStateCodes, getTcdbImportStateLabels } from "@/lib/tcdb";
import { getAllPublicImportSources, getBuiltInPublicImportSources, getDatabaseAutoImportSources, parsePublicImportSources } from "@/lib/auto-import-sources";
import { getPublicImportSourceKey } from "@/lib/import-source-keys";
import { runPublicSourceImports } from "@/lib/public-show-import";
import { recordImportFailure, type ImportSourceSummary } from "@/lib/show-import-ingest";
import { db } from "@/lib/db";

export type ScheduledImportRunResult = {
  sources: ImportSourceSummary[];
  imported: number;
  enriched: number;
  skipped: number;
  errors: string[];
};

export type ImportSourceHealth = {
  status: "healthy" | "attention" | "stale" | "empty" | "never";
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  detected: number;
  imported: number;
  skipped: number;
  errors: number;
  message: string | null;
  statusNote: string | null;
  consecutiveEmptyRuns: number;
  recentRuns: Array<{ at: string; detected: number; imported: number; skipped: number; errors: number }>;
};

type ImportLogLike = { createdAt: Date; imported: number; skipped: number; errors: number; errorDetails: string | null };

export function summarizeImportHealth(source: string, sourceLogs: ImportLogLike[], now = new Date()): ImportSourceHealth {
  const latest = sourceLogs[0];
  if (!latest) {
    return { status: "never", lastRunAt: null, lastSuccessAt: null, detected: 0, imported: 0, skipped: 0, errors: 0, message: null, statusNote: "This source has not recorded a scan yet.", consecutiveEmptyRuns: 0, recentRuns: [] };
  }

  const lastSuccess = sourceLogs.find((log) => log.errors === 0);
  let consecutiveEmptyRuns = 0;
  for (const log of sourceLogs) {
    if (log.errors > 0 || log.imported + log.skipped > 0) break;
    consecutiveEmptyRuns++;
  }
  const ageMs = now.getTime() - latest.createdAt.getTime();
  const stale = ageMs > 8 * 24 * 60 * 60 * 1000;
  const silentlyEmpty = source !== "tcdb" && latest.errors === 0 && consecutiveEmptyRuns >= 2;
  const status = latest.errors > 0 ? "attention" : stale ? "stale" : silentlyEmpty ? "empty" : "healthy";
  const statusNote = latest.errors > 0
    ? "The latest scan reported an error."
    : stale
      ? "No scan has been recorded in more than eight days."
      : silentlyEmpty
        ? `${consecutiveEmptyRuns} successful scans in a row detected no listings. The source layout may have changed.`
        : null;

  return {
    status,
    lastRunAt: latest.createdAt.toISOString(),
    lastSuccessAt: lastSuccess?.createdAt.toISOString() ?? null,
    detected: latest.imported + latest.skipped,
    imported: latest.imported,
    skipped: latest.skipped,
    errors: latest.errors,
    message: latest.errorDetails,
    statusNote,
    consecutiveEmptyRuns,
    recentRuns: sourceLogs.slice(0, 3).map((log) => ({
      at: log.createdAt.toISOString(),
      detected: log.imported + log.skipped,
      imported: log.imported,
      skipped: log.skipped,
      errors: log.errors,
    })),
  };
}

async function getImportHealth(sourceKeys: string[]) {
  try {
    const normalizedKeys = [...new Set(sourceKeys.map((key) => key.startsWith("tcdb:") ? "tcdb" : key))];
    const logs = await db.importLog.findMany({
      where: { source: { in: normalizedKeys } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const result = new Map<string, ImportSourceHealth>();
    for (const source of normalizedKeys) {
      const sourceLogs = logs.filter((log) => log.source === source);
      result.set(source, summarizeImportHealth(source, sourceLogs));
    }
    return result;
  } catch (error) {
    console.error("[auto-import] unable to load source health", error);
    return new Map<string, ImportSourceHealth>();
  }
}

export async function getAutoImportSourceSummaries() {
  const tcdbStateCodes = getAllTcdbImportStateCodes();
  const tcdbStateSources = tcdbStateCodes.map((code) => ({
    key: `tcdb:${code}`,
    label: `TCDB: ${code}`,
    type: `Single-state calendar scrape (${code})`,
    scheduleLabel: "Manual only",
    url: "https://www.tcdb.com/CardShowCalendar.cfm",
    origin: "environment" as const,
    active: true,
  }));
  const databaseSources = await getDatabaseAutoImportSources();
  const builtInSources = getBuiltInPublicImportSources();
  const environmentSources = parsePublicImportSources().filter(
    (envSource) =>
      !databaseSources.some((dbSource) => dbSource.url.toLowerCase() === envSource.url.toLowerCase()) &&
      !builtInSources.some((builtInSource) => builtInSource.url.toLowerCase() === envSource.url.toLowerCase())
  );
  const activeSources = await getAllPublicImportSources();
  const publicSources = activeSources.map((source) => ({
    key: getPublicImportSourceKey(source.name),
    label: source.name,
    type: /facebook\.com/i.test(source.url) ? "Facebook/Public Page" : "Website",
    scheduleLabel: "Mondays 6 AM",
    url: source.url,
    origin: source.origin ?? "database",
    active: source.active !== false,
  }));

  const listedSources = [
      {
        key: "tcdb",
        label: "Trading Card Database",
        type: `State calendar scrape (${getTcdbImportStateLabels().length} states)`,
        scheduleLabel: "Mondays 6 AM",
        url: "https://www.tcdb.com/CardShowCalendar.cfm",
        origin: "environment" as const,
        active: true,
      },
      ...tcdbStateSources,
      {
        key: "eventbrite",
        label: "Eventbrite",
        type: "Public events API",
        scheduleLabel: "Mondays 6 AM",
        url: "https://www.eventbrite.com/",
        origin: "environment" as const,
        active: true,
      },
      ...publicSources,
    ];
  const health = await getImportHealth(listedSources.map((source) => source.key));

  return {
    activeSources: listedSources.map((source) => ({
      ...source,
      health: health.get(source.key.startsWith("tcdb:") ? "tcdb" : source.key) ?? null,
    })),
    managedSources: databaseSources,
    environmentSources,
  };
}

function combineResults(results: ImportSourceSummary[]): ScheduledImportRunResult {
  return {
    sources: results,
    imported: results.reduce((sum, result) => sum + result.imported, 0),
    enriched: results.reduce((sum, result) => sum + result.enriched, 0),
    skipped: results.reduce((sum, result) => sum + result.skipped, 0),
    errors: results.flatMap((result) => result.errors.map((error) => `${result.label}: ${error}`)),
  };
}

export async function runScheduledImports() {
  return runScheduledImportsForSource("all");
}

export async function runScheduledImportsForSource(selectedSource: string) {
  const results: ImportSourceSummary[] = [];
  const requestedState = selectedSource.startsWith("tcdb:") ? selectedSource.slice("tcdb:".length).toUpperCase() : null;

  if (selectedSource === "all" || selectedSource === "tcdb" || selectedSource.startsWith("tcdb:")) {
    try {
      const tcdbResult = await runTcdbImport(requestedState ? [requestedState] : undefined);
      results.push(tcdbResult);
    } catch (error) {
      results.push(await recordImportFailure({
        source: selectedSource.startsWith("tcdb:") ? selectedSource : "tcdb",
        label: requestedState ? `Trading Card Database (${requestedState})` : "Trading Card Database",
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  if (selectedSource === "all" || selectedSource === "eventbrite") {
    const eventbriteResult = await runEventbriteImport();
    if (!("error" in eventbriteResult)) {
      results.push(eventbriteResult);
    } else {
      results.push(await recordImportFailure({
        source: "eventbrite",
        label: "Eventbrite",
        error: eventbriteResult.error,
      }));
    }
  }

  results.push(...(await runPublicSourceImports(selectedSource)));

  return combineResults(results);
}
