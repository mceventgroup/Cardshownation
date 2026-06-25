import { runEventbriteImport } from "@/lib/eventbrite-import";
import { runTcdbImport } from "@/lib/tcdb-import";
import { getTcdbImportStateLabels } from "@/lib/tcdb";
import { getAllPublicImportSources, getBuiltInPublicImportSources, getDatabaseAutoImportSources, parsePublicImportSources } from "@/lib/auto-import-sources";
import { runPublicSourceImports } from "@/lib/public-show-import";
import type { ImportSourceSummary } from "@/lib/show-import-ingest";

export type ScheduledImportRunResult = {
  sources: ImportSourceSummary[];
  imported: number;
  skipped: number;
  errors: string[];
};

export async function getAutoImportSourceSummaries() {
  const databaseSources = await getDatabaseAutoImportSources();
  const builtInSources = getBuiltInPublicImportSources();
  const environmentSources = parsePublicImportSources().filter(
    (envSource) =>
      !databaseSources.some((dbSource) => dbSource.url.toLowerCase() === envSource.url.toLowerCase()) &&
      !builtInSources.some((builtInSource) => builtInSource.url.toLowerCase() === envSource.url.toLowerCase())
  );
  const activeSources = await getAllPublicImportSources();
  const publicSources = activeSources.map((source) => ({
    key: `public:${source.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label: source.name,
    type: /facebook\.com/i.test(source.url) ? "Facebook/Public Page" : "Website",
    scheduleLabel: "Mondays 6 AM",
    url: source.url,
    origin: source.origin ?? "database",
    active: source.active !== false,
  }));

  return {
    activeSources: [
      {
        key: "tcdb",
        label: "Trading Card Database",
        type: `State calendar scrape (${getTcdbImportStateLabels().length} states)`,
        scheduleLabel: "Mondays 6 AM",
        url: "https://www.tcdb.com/CardShowCalendar.cfm",
        origin: "environment" as const,
        active: true,
      },
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
    ],
    managedSources: databaseSources,
    environmentSources,
  };
}

function combineResults(results: ImportSourceSummary[]): ScheduledImportRunResult {
  return {
    sources: results,
    imported: results.reduce((sum, result) => sum + result.imported, 0),
    skipped: results.reduce((sum, result) => sum + result.skipped, 0),
    errors: results.flatMap((result) => result.errors.map((error) => `${result.label}: ${error}`)),
  };
}

export async function runScheduledImports() {
  const results: ImportSourceSummary[] = [];

  const tcdbResult = await runTcdbImport();
  results.push(tcdbResult);

  const eventbriteResult = await runEventbriteImport();
  if (!("error" in eventbriteResult)) {
    results.push(eventbriteResult);
  } else {
    results.push({
      source: "eventbrite",
      label: "Eventbrite",
      imported: 0,
      skipped: 0,
      errors: [eventbriteResult.error],
    });
  }

  results.push(...(await runPublicSourceImports()));

  return combineResults(results);
}
