import type { UserRole } from "@csn/db";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { isFixtureMode } from "@/lib/data-mode";
import { fetchPublicUrl } from "@/lib/safe-remote-fetch";
import { informationScore, showMatchScore, type DedupeRecord } from "@/lib/show-dedupe";
import { normalizeExternalUrl } from "@/lib/url";

const MAX_SCANNED_SHOWS = 5_000;
const MAX_LINKS_PER_SCAN = 300;
const DISTINCT_ACTION = "data_quality.duplicates_kept_separate";
const LINK_SCAN_ACTION = "data_quality.link_scan";
const SHORTENER_HOSTS = new Set(["bit.ly", "tinyurl.com", "t.co", "ow.ly", "goo.gl", "rb.gy"]);

export type QualityShowRecord = {
  id: string;
  title: string;
  slug: string;
  status: string;
  sourceType: string;
  startDate: Date;
  endDate: Date;
  expiresAt: Date | null;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  city: string;
  state: string;
  isFree: boolean;
  admissionPrice: string | null;
  description: string | null;
  tableCount: number | null;
  vendorDetails: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  ticketUrl: string | null;
  parkingInfo: string | null;
  flyerImageUrl: string | null;
  categories: string[];
  organizerId: string | null;
  lastVerifiedAt: Date | null;
  updatedAt: Date;
  venueId: string | null;
  venue: { name: string; address1: string; city: string; state: string } | null;
  organizer: { name: string } | null;
  _count: { savedBy: number; reports: number; floorplans: number };
};

export type DuplicateQualityGroup = {
  key: string;
  score: number;
  recommendedKeepId: string;
  shows: Array<QualityShowRecord & { completeness: number }>;
};

export type ShowQualityIssue = {
  show: QualityShowRecord;
  issues: string[];
};

export type LinkQualityIssue = {
  showId: string;
  showTitle: string;
  field: "websiteUrl" | "facebookUrl" | "ticketUrl";
  url: string;
  problem: string;
};

function pairKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join("::");
}

function toDedupeRecord(show: QualityShowRecord): DedupeRecord {
  return {
    showName: show.title,
    startDate: show.startDate.toISOString().slice(0, 10),
    city: show.city,
    state: show.state,
    venueName: show.venue?.name,
    venueAddress: show.venue?.address1,
    description: show.description,
    websiteUrl: show.websiteUrl,
    facebookUrl: show.facebookUrl,
    tableCount: show.tableCount,
    startTimeLabel: show.startTimeLabel,
    endTimeLabel: show.endTimeLabel,
    admissionPrice: show.admissionPrice,
    vendorDetails: show.vendorDetails,
    parkingInfo: show.parkingInfo,
    categories: show.categories,
    isFree: show.isFree,
  };
}

export function getShowCompleteness(show: QualityShowRecord) {
  return informationScore(toDedupeRecord(show))
    + (show.organizerId ? 1 : 0)
    + (show.flyerImageUrl ? 1 : 0)
    + (show.ticketUrl ? 1 : 0);
}

export function findDuplicateQualityGroups(
  shows: QualityShowRecord[],
  ignoredPairs = new Set<string>()
): DuplicateQualityGroup[] {
  const eligible = shows.filter((show) => show.status === "APPROVED");
  const parent = new Map(eligible.map((show) => [show.id, show.id]));
  const pairScores = new Map<string, number>();
  const buckets = new Map<string, QualityShowRecord[]>();

  function find(id: string): string {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  }

  function union(left: string, right: string) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  }

  for (const show of eligible) {
    const key = `${show.startDate.toISOString().slice(0, 10)}|${show.state.toUpperCase()}`;
    buckets.set(key, [...(buckets.get(key) ?? []), show]);
  }

  for (const bucket of buckets.values()) {
    for (let leftIndex = 0; leftIndex < bucket.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bucket.length; rightIndex += 1) {
        const left = bucket[leftIndex];
        const right = bucket[rightIndex];
        const key = pairKey(left.id, right.id);
        if (ignoredPairs.has(key)) continue;
        const score = showMatchScore(toDedupeRecord(left), toDedupeRecord(right));
        if (score >= 72) {
          pairScores.set(key, score);
          union(left.id, right.id);
        }
      }
    }
  }

  const grouped = new Map<string, QualityShowRecord[]>();
  for (const show of eligible) {
    const root = find(show.id);
    grouped.set(root, [...(grouped.get(root) ?? []), show]);
  }

  return [...grouped.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const ranked = group
        .map((show) => ({ ...show, completeness: getShowCompleteness(show) }))
        .sort((left, right) => right.completeness - left.completeness || (right.lastVerifiedAt?.getTime() ?? 0) - (left.lastVerifiedAt?.getTime() ?? 0) || right.updatedAt.getTime() - left.updatedAt.getTime());
      let score = 0;
      for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
          score = Math.max(score, pairScores.get(pairKey(group[leftIndex].id, group[rightIndex].id)) ?? 0);
        }
      }
      return { key: ranked.map((show) => show.id).sort().join("::"), score, recommendedKeepId: ranked[0].id, shows: ranked };
    })
    .sort((left, right) => right.score - left.score || right.shows.length - left.shows.length);
}

export function inspectShowQuality(show: QualityShowRecord, now = new Date()) {
  const missing: string[] = [];
  const conflicts: string[] = [];
  const suspiciousLinks: LinkQualityIssue[] = [];

  if (!show.venue) missing.push("Venue");
  else if (!show.venue.address1 || /address unavailable/i.test(show.venue.address1)) missing.push("Venue address");
  if (!show.startTimeLabel) missing.push("Hours");
  if (!show.description) missing.push("Description");
  if (!show.categories.length) missing.push("Categories");
  if (!show.organizerId) missing.push("Promoter");
  if (!show.websiteUrl && !show.facebookUrl && !show.ticketUrl) missing.push("Event link");
  if (!show.isFree && !show.admissionPrice) missing.push("Admission details");
  if (show.endDate < show.startDate) conflicts.push("End date is before start date");
  if (show.venue && (show.venue.city.toLowerCase() !== show.city.toLowerCase() || show.venue.state.toUpperCase() !== show.state.toUpperCase())) conflicts.push("Venue location conflicts with show location");

  for (const field of ["websiteUrl", "facebookUrl", "ticketUrl"] as const) {
    const value = show[field];
    if (!value) continue;
    const normalized = normalizeExternalUrl(value);
    let problem: string | null = null;
    if (!normalized) problem = "Malformed or unsupported URL";
    else {
      const parsed = new URL(normalized);
      if (parsed.username || parsed.password) problem = "URL contains embedded credentials";
      else if (SHORTENER_HOSTS.has(parsed.hostname.toLowerCase())) problem = "Shortened link hides its destination";
      else if (/tcdb\.com$/i.test(parsed.hostname)) problem = "TCDB links are not allowed on listings";
    }
    if (problem) suspiciousLinks.push({ showId: show.id, showTitle: show.title, field, url: value, problem });
  }

  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    missing,
    conflicts,
    suspiciousLinks,
    approvedPast: show.status === "APPROVED" && (
      (show.expiresAt !== null && show.expiresAt.getTime() < now.getTime())
      || (show.expiresAt === null && show.endDate.getTime() < startOfToday.getTime())
    ),
  };
}

function readLinkIssues(details: unknown): { checkedAt: string; checked: number; truncated: boolean; issues: LinkQualityIssue[] } | null {
  if (!details || typeof details !== "object") return null;
  const value = details as Record<string, unknown>;
  if (!Array.isArray(value.issues) || typeof value.checkedAt !== "string") return null;
  return {
    checkedAt: value.checkedAt,
    checked: typeof value.checked === "number" ? value.checked : 0,
    truncated: value.truncated === true,
    issues: value.issues.filter((issue): issue is LinkQualityIssue => Boolean(issue && typeof issue === "object" && "showId" in issue && "url" in issue && "problem" in issue)),
  };
}

export async function getDataQualityReport(now = new Date()) {
  if (isFixtureMode()) return { scanned: 0, scanLimitReached: false, duplicateGroups: [], missingDetails: [], conflicts: [], approvedPast: [], suspiciousLinks: [], linkScan: null };
  const [shows, keptSeparateLogs, latestLinkScanLog] = await Promise.all([
    db.show.findMany({
      include: {
        venue: { select: { name: true, address1: true, city: true, state: true } },
        organizer: { select: { name: true } },
        _count: { select: { savedBy: true, reports: true, floorplans: true } },
      },
      orderBy: { startDate: "desc" },
      take: MAX_SCANNED_SHOWS + 1,
    }),
    db.auditLog.findMany({ where: { action: DISTINCT_ACTION, targetType: "ShowPair", targetId: { not: null } }, select: { targetId: true } }),
    db.auditLog.findFirst({ where: { action: LINK_SCAN_ACTION, targetType: "ShowCollection" }, orderBy: { createdAt: "desc" }, select: { details: true } }),
  ]);
  const scanLimitReached = shows.length > MAX_SCANNED_SHOWS;
  const scannedShows = shows.slice(0, MAX_SCANNED_SHOWS) as QualityShowRecord[];
  const ignoredPairs = new Set(keptSeparateLogs.flatMap((log) => log.targetId ? [log.targetId] : []));
  const missingDetails: ShowQualityIssue[] = [];
  const conflicts: ShowQualityIssue[] = [];
  const approvedPast: QualityShowRecord[] = [];
  const suspiciousLinks: LinkQualityIssue[] = [];

  for (const show of scannedShows) {
    const result = inspectShowQuality(show, now);
    if (result.missing.length && show.status === "APPROVED" && !result.approvedPast) missingDetails.push({ show, issues: result.missing });
    if (result.conflicts.length) conflicts.push({ show, issues: result.conflicts });
    if (result.approvedPast) approvedPast.push(show);
    suspiciousLinks.push(...result.suspiciousLinks);
  }

  return {
    scanned: scannedShows.length,
    scanLimitReached,
    duplicateGroups: findDuplicateQualityGroups(scannedShows, ignoredPairs),
    missingDetails: missingDetails.sort((left, right) => right.issues.length - left.issues.length),
    conflicts,
    approvedPast,
    suspiciousLinks,
    linkScan: readLinkIssues(latestLinkScanLog?.details),
  };
}

function requireAdmin(actor: { actorId: string; actorRole: UserRole }) {
  if (actor.actorRole !== "ADMIN") throw new Error("Only admins can manage data-quality findings.");
}

export async function keepShowsSeparate(showIds: string[], actor: { actorId: string; actorRole: UserRole }) {
  requireAdmin(actor);
  if (isFixtureMode()) return;
  const ids = [...new Set(showIds)].filter(Boolean).sort();
  if (ids.length < 2) throw new Error("At least two shows are required.");
  const existing = await db.show.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
  if (existing.length !== ids.length) throw new Error("One or more shows no longer exist.");
  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
      const key = pairKey(ids[leftIndex], ids[rightIndex]);
      const alreadyRecorded = await db.auditLog.findFirst({ where: { action: DISTINCT_ACTION, targetType: "ShowPair", targetId: key }, select: { id: true } });
      if (!alreadyRecorded) await writeAuditLog({ actorId: actor.actorId, actorRole: actor.actorRole, action: DISTINCT_ACTION, targetType: "ShowPair", targetId: key, details: { showIds: [ids[leftIndex], ids[rightIndex]] } });
    }
  }
}

export async function mergeQualityShows(keepId: string, removeId: string, actor: { actorId: string; actorRole: UserRole }) {
  requireAdmin(actor);
  if (isFixtureMode()) throw new Error("Data-quality actions are unavailable in fixture mode.");
  if (!keepId || !removeId || keepId === removeId) throw new Error("Choose two different shows.");
  const [keeper, duplicate] = await Promise.all([
    db.show.findUnique({ where: { id: keepId }, include: { venue: { select: { name: true, address1: true } }, savedBy: { select: { userId: true } }, tags: { select: { label: true } }, floorplans: { select: { id: true, name: true } } } }),
    db.show.findUnique({ where: { id: removeId }, include: { venue: { select: { name: true, address1: true } }, savedBy: { select: { userId: true } }, tags: { select: { label: true } }, floorplans: { select: { id: true, name: true } } } }),
  ]);
  if (!keeper || !duplicate) throw new Error("One or both shows no longer exist.");
  const score = showMatchScore(
    { showName: keeper.title, startDate: keeper.startDate.toISOString().slice(0, 10), city: keeper.city, state: keeper.state, venueName: keeper.venue?.name, venueAddress: keeper.venue?.address1 },
    { showName: duplicate.title, startDate: duplicate.startDate.toISOString().slice(0, 10), city: duplicate.city, state: duplicate.state, venueName: duplicate.venue?.name, venueAddress: duplicate.venue?.address1 }
  );
  if (score < 72) throw new Error("These listings no longer pass the duplicate safety check.");

  const changedFields: string[] = [];
  const choose = <T,>(field: string, current: T | null, incoming: T | null) => {
    const currentMissing = current === null || (typeof current === "string" && current.trim() === "");
    const incomingPresent = incoming !== null && (typeof incoming !== "string" || incoming.trim() !== "");
    if (currentMissing && incomingPresent) {
      changedFields.push(field);
      return incoming;
    }
    return current;
  };
  const mergedCategories = [...new Set([...keeper.categories, ...duplicate.categories])];
  if (mergedCategories.length !== keeper.categories.length) changedFields.push("categories");
  const usedFloorplanNames = new Set(keeper.floorplans.map((floorplan) => floorplan.name));

  await db.$transaction(async (transaction) => {
    await transaction.show.update({
      where: { id: keeper.id },
      data: {
        description: choose("description", keeper.description, duplicate.description),
        startTimeLabel: choose("startTimeLabel", keeper.startTimeLabel, duplicate.startTimeLabel),
        endTimeLabel: choose("endTimeLabel", keeper.endTimeLabel, duplicate.endTimeLabel),
        admissionPrice: choose("admissionPrice", keeper.admissionPrice, duplicate.admissionPrice),
        admissionNotes: choose("admissionNotes", keeper.admissionNotes, duplicate.admissionNotes),
        tableCount: choose("tableCount", keeper.tableCount, duplicate.tableCount),
        vendorDetails: choose("vendorDetails", keeper.vendorDetails, duplicate.vendorDetails),
        estimatedAttendance: choose("estimatedAttendance", keeper.estimatedAttendance, duplicate.estimatedAttendance),
        flyerImageUrl: choose("flyerImageUrl", keeper.flyerImageUrl, duplicate.flyerImageUrl),
        websiteUrl: choose("websiteUrl", keeper.websiteUrl, duplicate.websiteUrl),
        facebookUrl: choose("facebookUrl", keeper.facebookUrl, duplicate.facebookUrl),
        ticketUrl: choose("ticketUrl", keeper.ticketUrl, duplicate.ticketUrl),
        parkingInfo: choose("parkingInfo", keeper.parkingInfo, duplicate.parkingInfo),
        loadInInfo: choose("loadInInfo", keeper.loadInInfo, duplicate.loadInInfo),
        venueNotes: choose("venueNotes", keeper.venueNotes, duplicate.venueNotes),
        organizerId: choose("organizerId", keeper.organizerId, duplicate.organizerId),
        venueId: choose("venueId", keeper.venueId, duplicate.venueId),
        categories: mergedCategories,
        isFree: keeper.isFree,
        lastVerifiedAt: new Date(),
      },
    });
    if (duplicate.savedBy.length) await transaction.savedShow.createMany({ data: duplicate.savedBy.map((saved) => ({ userId: saved.userId, showId: keeper.id })), skipDuplicates: true });
    if (duplicate.tags.length) await transaction.showTag.createMany({ data: duplicate.tags.map((tag) => ({ label: tag.label, showId: keeper.id })), skipDuplicates: true });
    await transaction.showReport.updateMany({ where: { showId: duplicate.id }, data: { showId: keeper.id } });
    await transaction.showSubmission.updateMany({ where: { reviewedShowId: duplicate.id }, data: { reviewedShowId: keeper.id } });
    for (const floorplan of duplicate.floorplans) {
      let name = floorplan.name;
      let suffix = 2;
      while (usedFloorplanNames.has(name)) name = `${floorplan.name} (merged ${suffix++})`;
      usedFloorplanNames.add(name);
      await transaction.showFloorplan.update({ where: { id: floorplan.id }, data: { showId: keeper.id, name } });
    }
    await transaction.show.delete({ where: { id: duplicate.id } });
    const favoriteCount = await transaction.savedShow.count({ where: { showId: keeper.id } });
    await transaction.show.update({ where: { id: keeper.id }, data: { favoriteCount } });
  });

  await writeAuditLog({ actorId: actor.actorId, actorRole: actor.actorRole, action: "data_quality.shows_merged", targetType: "Show", targetId: keeper.id, details: { removedShowId: duplicate.id, removedTitle: duplicate.title, changedFields } });
  return { keeperId: keeper.id, removedId: duplicate.id, changedFields };
}

export async function deleteQualityShow(showId: string, actor: { actorId: string; actorRole: UserRole }) {
  requireAdmin(actor);
  if (isFixtureMode()) return null;
  const show = await db.show.findUnique({ where: { id: showId }, select: { id: true, title: true, slug: true } });
  if (!show) return null;
  await db.show.delete({ where: { id: show.id } });
  await writeAuditLog({ actorId: actor.actorId, actorRole: actor.actorRole, action: "data_quality.show_deleted", targetType: "Show", targetId: show.id, details: { title: show.title, slug: show.slug } });
  return show;
}

export async function markQualityShowExpired(showId: string, actor: { actorId: string; actorRole: UserRole }) {
  requireAdmin(actor);
  if (isFixtureMode()) return null;
  const show = await db.show.update({ where: { id: showId }, data: { status: "EXPIRED" }, select: { id: true, title: true } });
  await writeAuditLog({ actorId: actor.actorId, actorRole: actor.actorRole, action: "data_quality.show_expired", targetType: "Show", targetId: show.id, details: { title: show.title } });
  return show;
}

export async function runShowLinkScan(actor: { actorId: string; actorRole: UserRole }) {
  requireAdmin(actor);
  if (isFixtureMode()) return { checkedAt: new Date().toISOString(), checked: 0, truncated: false, issues: [] as LinkQualityIssue[] };
  const shows = await db.show.findMany({
    where: { status: "APPROVED" },
    select: { id: true, title: true, websiteUrl: true, facebookUrl: true, ticketUrl: true },
    orderBy: { startDate: "asc" },
    take: MAX_SCANNED_SHOWS,
  });
  const allLinks = shows.flatMap((show) => (["websiteUrl", "facebookUrl", "ticketUrl"] as const).flatMap((field) => show[field] ? [{ showId: show.id, showTitle: show.title, field, url: show[field]! }] : []));
  const links = allLinks.slice(0, MAX_LINKS_PER_SCAN);
  const truncated = allLinks.length > MAX_LINKS_PER_SCAN;
  const issues: LinkQualityIssue[] = [];
  for (let index = 0; index < links.length; index += 12) {
    const chunk = links.slice(index, index + 12);
    const results = await Promise.all(chunk.map(async (link) => {
      try {
        const response = await fetchPublicUrl(link.url, { method: "HEAD", headers: { "user-agent": "CardShowNation-LinkCheck/1.0" } }, 5_000);
        if (response.status >= 400 && ![401, 403, 405, 429].includes(response.status)) return { ...link, problem: `Destination returned HTTP ${response.status}` };
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/redirect/i.test(message)) return null;
        return { ...link, problem: /private|reserved|not allowed/i.test(message) ? "Unsafe destination" : "Destination could not be reached" };
      }
    }));
    issues.push(...results.filter((issue): issue is LinkQualityIssue => issue !== null));
  }
  const checkedAt = new Date().toISOString();
  await writeAuditLog({ actorId: actor.actorId, actorRole: actor.actorRole, action: LINK_SCAN_ACTION, targetType: "ShowCollection", targetId: checkedAt, details: { checkedAt, checked: links.length, truncated, issues } });
  return { checkedAt, checked: links.length, truncated, issues };
}
