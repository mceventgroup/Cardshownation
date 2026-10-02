import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { getAllPublicImportSources } from "@/lib/auto-import-sources";
import { getPublicImportSourceKey } from "@/lib/import-source-keys";
import { ingestImportedShows, type ImportedShow } from "@/lib/show-import-ingest";
import { approveShowSubmission, getDuplicateReview } from "@/lib/submissions";
import { validateImportedShow, differentSessions } from "@/lib/local-import-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
  return Boolean(expected && provided && timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(provided).digest()));
}

// Explicit public/import fields only: never expose submitter emails, accounts or claim controls.
function safeRecord(payload: Record<string, unknown>) {
  const fields = ["showName", "startDate", "endDate", "city", "state", "venueName", "venueAddress", "description", "websiteUrl", "facebookUrl", "sourceUrl", "categories", "isFree", "admissionPrice", "admissionNotes", "startTimeLabel", "endTimeLabel", "tableCount", "source", "externalId"];
  return Object.fromEntries(fields.map((key) => [key, payload[key] ?? null]));
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "Unauthorized" }, 401);
  if (isFixtureMode()) return json({ error: "Live database is required" }, 503);
  const [shows, submissions, sources] = await Promise.all([
    db.show.findMany({ include: { venue: true } }),
    db.showSubmission.findMany({ select: { id: true, status: true, reviewedShowId: true, payloadJson: true } }),
    getAllPublicImportSources(),
  ]);
  return json({ version: 1, generatedAt: new Date().toISOString(), sources, records: [
    ...shows.map((show) => ({ id: show.id, kind: "show", status: show.status, record: safeRecord({ ...show, showName: show.title, startDate: show.startDate.toISOString().slice(0, 10), endDate: show.endDate.toISOString().slice(0, 10), venueName: show.venue?.name, venueAddress: show.venue?.address1 }) })),
    ...submissions.filter((row) => row.status === "PENDING" || Boolean((row.payloadJson as Record<string, unknown>).externalId)).map((row) => {
      const payload = row.payloadJson as Record<string, unknown>;
      const published = row.reviewedShowId ? shows.find((show) => show.id === row.reviewedShowId) : null;
      return { id: row.id, kind: "submission", status: row.status, record: safeRecord(published ? { ...published, source: payload.source, externalId: payload.externalId, showName: published.title, startDate: published.startDate.toISOString().slice(0, 10), endDate: published.endDate.toISOString().slice(0, 10), venueName: published.venue?.name, venueAddress: published.venue?.address1 } : payload) };
    }),
  ] });
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: "Unauthorized" }, 401);
  if (isFixtureMode()) return json({ error: "Live database is required" }, 503);
  const content = await request.text();
  if (Buffer.byteLength(content) > 1024 * 1024) return json({ error: "Batch exceeds 1 MB" }, 413);
  let input: { source: string; label: string; batchId: string; shows?: unknown[]; report?: { imported: number; skipped: number; errors: string[] } };
  try {
    input = JSON.parse(content);
    if (!input || typeof input.source !== "string" || typeof input.label !== "string" || input.label.length > 200 || typeof input.batchId !== "string" || !/^[a-zA-Z0-9:._-]{1,200}$/.test(input.batchId)) throw new Error("Invalid batch metadata");
    const allowed = new Set(["tcdb", "eventbrite", "kansas-card-show-database", ...(await getAllPublicImportSources()).map((source) => getPublicImportSourceKey(source.name))]);
    if (!allowed.has(input.source)) throw new Error("Unknown source");
    if (input.report) {
      if (input.shows || !Number.isSafeInteger(input.report.imported) || input.report.imported < 0 || !Number.isSafeInteger(input.report.skipped) || input.report.skipped < 0 || !Array.isArray(input.report.errors) || input.report.errors.length > 100 || input.report.errors.some((error) => typeof error !== "string" || error.length > 2000)) throw new Error("Invalid report");
    } else if (!Array.isArray(input.shows) || input.shows.length > 25) throw new Error("At most 25 changed shows per batch");
    if (input.shows) input.shows = input.shows.map((show) => validateImportedShow(show, input.source));
  } catch (error) { return json({ error: (error as Error).message }, 400); }

  // The content hash prevents callers from reusing a batch ID for different data.
  const key = input.report ? input.batchId : `${input.batchId}:${createHash("sha256").update(content).digest("hex")}`;
  const previous = await db.auditLog.findFirst({ where: { action: "automation.import_batch", targetType: "ImportBatch", targetId: key }, select: { details: true } });
  if (previous) return json(previous.details);
  if (input.report) {
    const batchPrefix = input.batchId.replace(/report$/, "");
    const batches = await db.auditLog.findMany({ where: { action: "automation.import_batch", targetType: "ImportBatch", targetId: { startsWith: batchPrefix } }, select: { details: true } });
    const published = new Set(batches.flatMap((batch) => {
      const details = batch.details as { publishedIds?: string[] } | null;
      return details?.publishedIds ?? [];
    }));
    const result = { ok: true, recorded: true, published: published.size };
    await db.$transaction([
      db.importLog.create({ data: { source: input.source, imported: published.size, skipped: input.report.skipped, errors: input.report.errors.length, errorDetails: input.report.errors.join("\n") || null } }),
      db.auditLog.create({ data: { action: "automation.import_batch", targetType: "ImportBatch", targetId: key, details: result } }),
    ]);
    return json(result);
  }
  const accepted: ImportedShow[] = [], errors: string[] = [];
  for (const show of input.shows as ReturnType<typeof validateImportedShow>[]) {
    const review = await getDuplicateReview({ ...show, showName: show.title, startDate: show.startDate.toISOString().slice(0, 10) });
    if (review && (review.score < 72 || differentSessions({ showName: show.title }, review.record as Record<string, unknown>))) errors.push(`${show.title}: Ambiguous duplicate; retained for review`);
    else accepted.push(show);
  }
  const summary = await ingestImportedShows({ source: input.source, label: input.label, submitterName: `${input.label} Import`, submitterEmail: "import@cardshownation.com", shows: accepted, recordLog: false });
  const publishedIds: string[] = [];
  for (const id of summary.submissionIds ?? []) {
    try {
      const show = await approveShowSubmission(id, { reviewerRole: "ADMIN", notes: "Validated local Codex import batch" });
      if (show) publishedIds.push(show.id); else errors.push(`Submission ${id}: Approval did not produce a show`);
    } catch (error) { errors.push(`Submission ${id}: ${(error as Error).message}`); }
  }
  const result = { ...summary, errors: [...summary.errors, ...errors], publishedIds };
  // Do not cache partial failures: a retry can resume the validated pending records.
  if (!result.errors.length) await db.auditLog.create({ data: { action: "automation.import_batch", targetType: "ImportBatch", targetId: key, details: result } });
  revalidatePath("/"); revalidatePath("/shows"); revalidatePath("/admin/imports");
  return json(result, result.errors.length ? 207 : 200);
}
