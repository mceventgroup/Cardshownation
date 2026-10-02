import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { centralToday, planLocalImport, type SnapshotRecord } from "../apps/web/lib/local-import-plan";
import type { ImportedShow } from "../apps/web/lib/show-import-ingest";
import type { PublicImportSource } from "../apps/web/lib/auto-import-sources";

type Scan = { source: string; label: string; shows: ImportedShow[]; errors: string[]; coverage: string[] };
type Snapshot = { version: number; generatedAt: string; sources: PublicImportSource[]; records: SnapshotRecord[] };
const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const publish = args.includes("--publish");
const baseUrl = new URL(option("--url") ?? "https://www.cardshownation.com");
if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "127.0.0.1") throw new Error("HTTPS is required");
if (!new Set(["www.cardshownation.com", "cardshownation.com", "127.0.0.1"]).has(baseUrl.hostname)) throw new Error("Unapproved publishing host");
const envPath = option("--env-file") ?? "apps/web/.vercel/prod.env";
const credentials = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
const secret = process.env.CRON_SECRET ?? credentials.CRON_SECRET;
if (!secret && !option("--snapshot-file")) throw new Error("CRON_SECRET is required; never print it");
const endpoint = new URL("/api/automation/imports", baseUrl);

async function request(body?: unknown) {
  const response = await fetch(endpoint, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "error", signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`Import endpoint HTTP ${response.status}`);
  return response.json();
}

async function scanSources(sources: PublicImportSource[]): Promise<Scan[]> {
  // Scanning has no database credentials. All Neon access goes through the bounded API phase.
  delete process.env.DATABASE_URL; delete process.env.DIRECT_URL;
  const { fetchPublicSourceShows } = await import("../apps/web/lib/public-show-import");
  const { getPublicImportSourceKey } = await import("../apps/web/lib/import-source-keys");
  const { fetchKansasCardShowSheet, KANSAS_SHEET_SOURCE, KANSAS_SHEET_LABEL } = await import("../apps/web/lib/kansas-card-show-sheet");
  const { fetchTcdbShowsByState, getAllTcdbImportStateCodes } = await import("../apps/web/lib/tcdb");
  const scans: Scan[] = [];
  const collect = async (source: string, label: string, fn: (scan: Scan) => Promise<void>) => {
    const scan: Scan = { source, label, shows: [], errors: [], coverage: [] };
    try { await fn(scan); } catch (error) { scan.errors.push((error as Error).message); }
    console.log(`${label}: ${scan.shows.length} listings fetched, ${scan.errors.length} errors`);
    scans.push(scan);
  };
  await collect(KANSAS_SHEET_SOURCE, KANSAS_SHEET_LABEL, async (scan) => {
    const result = await fetchKansasCardShowSheet();
    if (!result.rowsRead) throw new Error("Published sheet has no rows");
    scan.shows = result.shows; scan.errors.push(...result.errors); scan.coverage = [...new Set(scan.shows.map((show) => show.state))];
  });
  await collect("tcdb", "Trading Card Database", async (scan) => {
    for (const state of getAllTcdbImportStateCodes()) {
      try { scan.shows.push(...await fetchTcdbShowsByState(state)); scan.coverage.push(state); }
      catch (error) {
        scan.errors.push(`${state}: ${(error as Error).message}`);
        if (/HTTP (403|429)/.test((error as Error).message)) { scan.errors.push("Remaining states not scanned: source blocked or rate limited"); break; }
      }
    }
  });
  await collect("eventbrite", "Eventbrite", async (scan) => {
    const apiKey = process.env.EVENTBRITE_API_KEY ?? credentials.EVENTBRITE_API_KEY;
    if (!apiKey) throw new Error("EVENTBRITE_API_KEY is not configured; source was not scanned");
    const { fetchCardShowsFromEventbrite } = await import("../apps/web/lib/eventbrite");
    scan.shows = await fetchCardShowsFromEventbrite(apiKey, { pageLimit: 100, onError: (error) => scan.errors.push(error.slice(0, 1800)) });
    scan.coverage = [...new Set(scan.shows.map((show) => show.state))];
  });
  for (const source of sources.filter((source) => source.active !== false)) await collect(getPublicImportSourceKey(source.name), source.name, async (scan) => {
    scan.shows = await fetchPublicSourceShows(source); scan.coverage = [...new Set(scan.shows.map((show) => show.state))];
  });
  return scans;
}

async function main() {
  const snapshot: Snapshot = option("--snapshot-file") ? JSON.parse(readFileSync(option("--snapshot-file")!, "utf8")) : await request();
  if (snapshot.version !== 1 || !Array.isArray(snapshot.records) || !Array.isArray(snapshot.sources)) throw new Error("Unexpected snapshot format");
  if (publish && option("--snapshot-file")) throw new Error("Cannot publish using an offline snapshot");
  const scanFile = option("--scan-file");
  const saved = scanFile ? JSON.parse(readFileSync(scanFile, "utf8")) : null;
  const scans: Scan[] = saved ? saved.scans.map((scan: Scan) => ({ ...scan, shows: scan.shows.map((show) => ({ ...show, startDate: new Date(show.startDate), endDate: new Date(show.endDate) })) })) : await scanSources(snapshot.sources);
  const runId: string = saved ? saved.runId : new Date().toISOString().replace(/[^0-9]/g, "");
  if (!/^[0-9]{17}$/.test(runId)) throw new Error("Invalid saved run ID");
  const output = resolve(".local-import"); mkdirSync(output, { recursive: true });
  const scanPath = resolve(output, `${runId}-scan.json`);
  if (!scanFile) writeFileSync(scanPath, JSON.stringify({ runId, scans }, null, 2));
  const reports = [];
  const records = structuredClone(snapshot.records);
  let requests = option("--snapshot-file") ? 0 : 1;
  for (const scan of scans) {
    const plan = planLocalImport(scan.source, scan.shows, records);
    const errors = [...scan.errors, ...plan.errors];
    const publishedIds: string[] = [];
    let imported = 0, enriched = 0, eligiblePending = 0;
    if (publish) {
      for (let index = 0; index < plan.changes.length; index += 25) {
        const batch = plan.changes.slice(index, index + 25);
        const batchHash = createHash("sha256").update(JSON.stringify(batch)).digest("hex").slice(0, 24);
        const result = await request({ source: scan.source, label: scan.label, batchId: `${runId}:${scan.source}:${batchHash}`, shows: batch }); requests++;
        imported += result.imported; enriched += result.enriched; publishedIds.push(...result.publishedIds);
        errors.push(...result.errors); eligiblePending += (result.submissionIds?.length ?? 0) - result.publishedIds.length;
      }
      const reportErrors = [...errors, ...plan.ambiguous.map((pair) => `Ambiguous: ${pair}`)].slice(0, 100).map((error) => error.slice(0, 2000));
      await request({ source: scan.source, label: scan.label, batchId: `${runId}:${scan.source}:report`, report: { imported: publishedIds.length, skipped: plan.skipped + plan.expired, errors: reportErrors } }); requests++;
    }
    reports.push({ source: scan.source, scanned: scan.shows.length, changes: plan.changes.length, expired: plan.expired, skipped: plan.skipped, ambiguous: plan.ambiguous, imported, enriched, published: publishedIds.length, publishedIds, eligiblePending, errors, coverage: scan.coverage });
  }
  // Verify from one fresh snapshot against the saved scan; never crawl/import all sources again.
  let remainingChanges: number | null = null;
  if (publish) {
    const verified: Snapshot = await request(); requests++;
    remainingChanges = 0;
    for (const scan of scans) remainingChanges += planLocalImport(scan.source, scan.shows, verified.records, centralToday()).changes.length;
  }
  const summary = { runId, mode: publish ? "publish" : "dry-run", at: new Date().toISOString(), snapshotAt: snapshot.generatedAt, apiRequests: requests, remainingChanges, reports, scanFile: scanFile ?? scanPath };
  const reportPath = resolve(output, `${runId}-report.json`);
  writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Saved report: ${reportPath}`);
  if (remainingChanges || reports.some((report) => report.eligiblePending > 0)) process.exitCode = 1;
}
main().catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
