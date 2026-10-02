import { showMatchScore } from "./show-dedupe";
import { mergeMissingShowDetails, mergePersistableShowDetails } from "./show-enrichment";
import { US_STATES } from "./states";
import type { ImportedShow } from "./show-import-ingest";

export type SnapshotRecord = {
  id: string;
  kind: "show" | "submission";
  status: string;
  record: Record<string, unknown>;
};

export function centralToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function candidateRecord(show: ImportedShow, source: string): Record<string, unknown> {
  return { ...show, showName: show.title, startDate: show.startDate.toISOString().slice(0, 10), endDate: show.endDate.toISOString().slice(0, 10),
    websiteUrl: source === "tcdb" ? null : show.websiteUrl, sourceUrl: source === "tcdb" ? null : show.sourceUrl ?? null };
}

export function differentSessions(left: Record<string, unknown>, right: Record<string, unknown>) {
  const session = (row: Record<string, unknown>) => String(row.showName ?? "").toLowerCase().match(/\b(trade night|autograph|vip|preview)\b/g)?.sort().join("|") ?? "";
  return session(left) !== session(right);
}

// This boundary is also used by the server. Only recognized fields reach the approval flow.
export function validateImportedShow(value: unknown, source: string, today = centralToday()): ImportedShow {
  if (!value || typeof value !== "object") throw new Error("Invalid show");
  const row = value as Record<string, unknown>;
  const text = (key: string, required = false, limit = 1000) => {
    const raw = row[key];
    if (raw !== null && raw !== undefined && typeof raw !== "string") throw new Error(`Invalid ${key}`);
    const result = typeof raw === "string" ? raw.trim() : "";
    if ((required && !result) || result.length > limit) throw new Error(`Invalid ${key}`);
    if (/tcdb\.com/i.test(result) && key !== "externalId") throw new Error("TCDB links cannot be published");
    return result || null;
  };
  const date = (key: string) => {
    const raw = row[key];
    const result = raw instanceof Date ? raw : typeof raw === "string" ? new Date(raw) : new Date(NaN);
    if (!Number.isFinite(result.getTime())) throw new Error(`Invalid ${key}`);
    return result;
  };
  const startDate = date("startDate"), endDate = date("endDate");
  // These are calendar dates; some feeds attach noon to the start and midnight to the end.
  if (endDate.toISOString().slice(0, 10) < startDate.toISOString().slice(0, 10) || endDate.toISOString().slice(0, 10) < today) throw new Error("Expired or invalid date range");
  const state = text("state", true, 2)!.toUpperCase();
  if (!US_STATES.some((item) => item.code === state)) throw new Error("Invalid state");
  if (!Array.isArray(row.categories) || row.categories.length > 12 || row.categories.some((item) => typeof item !== "string" || !item.trim() || item.length > 80 || /tcdb\.com/i.test(item))) throw new Error("Invalid categories");
  if (typeof row.isFree !== "boolean") throw new Error("Invalid admission status");
  const link = (key: string) => {
    if (source === "tcdb" && (key === "sourceUrl" || key === "websiteUrl")) return null;
    const result = text(key, false, 2000);
    if (result) { const url = new URL(result); if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error(`Invalid ${key}`); }
    return result;
  };
  const number = (key: string, min: number, max: number) => {
    const raw = row[key];
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < min || raw > max) throw new Error(`Invalid ${key}`);
    return raw;
  };
  return { externalId: text("externalId", true, 300)!, title: text("title", true, 300)!, city: text("city", true, 120)!, state, startDate, endDate,
    description: text("description", false, 20000), venueName: text("venueName", false, 300), venueAddress: text("venueAddress", false, 500),
    venueLat: number("venueLat", -90, 90), venueLng: number("venueLng", -180, 180), isFree: row.isFree,
    admissionPrice: text("admissionPrice"), admissionNotes: text("admissionNotes"), websiteUrl: link("websiteUrl"), sourceUrl: link("sourceUrl"), facebookUrl: link("facebookUrl"),
    categories: row.categories.map((item) => String(item).trim()), organizerName: text("organizerName", false, 300),
    startTimeLabel: text("startTimeLabel", false, 100), endTimeLabel: text("endTimeLabel", false, 100), tableCount: number("tableCount", 1, 100000) };
}

export function planLocalImport(source: string, shows: ImportedShow[], records: SnapshotRecord[], today = centralToday()) {
  const changes: ImportedShow[] = [], ambiguous: string[] = [], errors: string[] = [];
  let skipped = 0, expired = 0;
  for (const raw of shows) {
    if (raw.endDate instanceof Date && Number.isFinite(raw.endDate.getTime()) && raw.endDate.toISOString().slice(0, 10) < today) { expired++; continue; }
    let show: ImportedShow;
    try { show = validateImportedShow(raw, source, today); } catch (error) { errors.push(`${raw.title}: ${(error as Error).message}`); continue; }
    const incoming = candidateRecord(show, source);
    const identity = records.find((item) => item.record.source === source && item.record.externalId === show.externalId);
    if (identity?.status === "REJECTED") { skipped++; continue; }
    const matches = records.filter((item) => item.status !== "REJECTED").map((item) => ({ item, score: showMatchScore(incoming, item.record) })).filter((item) => item.score >= 55).sort((a, b) => b.score - a.score);
    const best = matches[0];
    if (best && (best.score < 72 || differentSessions(incoming, best.item.record))) { ambiguous.push(`${show.title} / ${best.item.record.showName}`); continue; }
    const existing = identity?.record ?? best?.item.record;
    const target = identity ?? best?.item;
    const retryPending = identity?.status === "PENDING" && !identity.id.startsWith("local:");
    const merge = target?.kind === "show" || target?.status === "APPROVED" ? mergePersistableShowDetails : mergeMissingShowDetails;
    if (existing && !retryPending && merge(existing, incoming).changedFields.length === 0) { skipped++; continue; }
    changes.push(show);
    // Later sources compare against this planned change, too.
    if (existing) Object.assign(existing, merge(existing, incoming).merged);
    else records.push({ id: `local:${source}:${show.externalId}`, kind: "submission", status: "PENDING", record: { ...incoming, source } });
  }
  return { changes, skipped, expired, ambiguous, errors };
}
