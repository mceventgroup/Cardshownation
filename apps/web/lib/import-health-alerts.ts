import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { sendImportHealthAlertEmail, sendImportHealthWeeklySummaryEmail } from "@/lib/email";
import { getAutoImportSourceSummaries, type ImportSourceHealth } from "@/lib/scheduled-imports";

type AlertableStatus = Exclude<ImportSourceHealth["status"], "never">;
const STATE_ACTION = "import_health.state";
const WEEKLY_ACTION = "import_health.weekly_summary";

function readRecordedStatus(details: unknown): ImportSourceHealth["status"] | null {
  if (!details || typeof details !== "object" || !("status" in details)) return null;
  const status = (details as { status?: unknown }).status;
  return status === "healthy" || status === "attention" || status === "stale" || status === "empty" || status === "never" ? status : null;
}

export function getImportHealthNotificationType(previous: ImportSourceHealth["status"] | null, current: ImportSourceHealth["status"]) {
  if (current === "never" || current === previous) return null;
  if (current === "healthy") return previous && previous !== "healthy" && previous !== "never" ? "recovered" as const : null;
  return "problem" as const;
}

function statusLabel(status: AlertableStatus) {
  if (status === "attention") return "Latest scan failed";
  if (status === "stale") return "Scan is overdue";
  if (status === "empty") return "Repeated scans found no listings";
  return "Source is healthy again";
}

function startOfIsoWeek(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

async function getAdminRecipients() {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true } });
  return [...new Map(admins.map((admin) => [admin.email.trim().toLowerCase(), { id: admin.id, email: admin.email.trim().toLowerCase() }] as const)).values()].filter((admin) => admin.email);
}

export async function runImportHealthNotifications(options: { now?: Date; includeWeeklySummary?: boolean } = {}) {
  if (isFixtureMode()) return { alerts: 0, recoveries: 0, summaries: 0, failed: 0 };
  const now = options.now ?? new Date();
  const sourceData = await getAutoImportSourceSummaries();
  const sources = sourceData.activeSources.filter((source) => source.active && source.scheduleLabel !== "Manual only" && source.health);
  const recipients = await getAdminRecipients();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cardshownation.com").replace(/\/+$/, "");
  let alerts = 0, recoveries = 0, summaries = 0, failed = 0;

  for (const source of sources) {
    const health = source.health!;
    const previousLog = await db.auditLog.findFirst({ where: { action: STATE_ACTION, targetType: "ImportSource", targetId: source.key }, orderBy: { createdAt: "desc" }, select: { details: true } });
    const previous = readRecordedStatus(previousLog?.details);
    const notificationType = getImportHealthNotificationType(previous, health.status);
    let deliverySucceeded = recipients.length === 0 || notificationType === null;
    if (notificationType && health.status !== "never") {
      let successfulDeliveries = 0;
      for (const recipient of recipients) {
        try {
          await sendImportHealthAlertEmail(recipient.email, { sourceLabel: source.label, status: health.status, message: health.statusNote ?? health.message ?? statusLabel(health.status), dashboardUrl: `${appUrl}/admin/imports?source=${encodeURIComponent(source.key)}#source-health` });
          successfulDeliveries += 1;
        } catch (error) {
          failed += 1;
          console.error("[import health] alert delivery failed", { source: source.key, recipientId: recipient.id, error });
        }
      }
      deliverySucceeded = successfulDeliveries === recipients.length;
      if (deliverySucceeded) notificationType === "recovered" ? recoveries += 1 : alerts += 1;
    }
    if (deliverySucceeded && previous !== health.status) {
      await db.auditLog.create({ data: { action: STATE_ACTION, targetType: "ImportSource", targetId: source.key, details: { status: health.status, lastRunAt: health.lastRunAt, recordedAt: now.toISOString() } } });
    }
  }

  if (options.includeWeeklySummary) {
    const weekKey = startOfIsoWeek(now);
    const problemSources = sources.filter((source) => source.health && source.health.status !== "healthy").map((source) => ({ label: source.label, status: source.health!.status === "never" ? "Never scanned" : statusLabel(source.health!.status), message: source.health!.statusNote ?? source.health!.message ?? "Review this source." }));
    const healthyCount = sources.length - problemSources.length;
    for (const recipient of recipients) {
      const deliveryKey = `${weekKey}:${recipient.id}`;
      const alreadySent = await db.auditLog.findFirst({ where: { action: WEEKLY_ACTION, targetType: "ImportHealthSummary", targetId: deliveryKey }, select: { id: true } });
      if (alreadySent) continue;
      try {
        await sendImportHealthWeeklySummaryEmail(recipient.email, { dashboardUrl: `${appUrl}/admin/imports#source-health`, healthyCount, problemSources });
        await db.auditLog.create({ data: { action: WEEKLY_ACTION, targetType: "ImportHealthSummary", targetId: deliveryKey, details: { weekKey, healthyCount, problemCount: problemSources.length } } });
        summaries += 1;
      } catch (error) {
        failed += 1;
        console.error("[import health] weekly summary delivery failed", { recipientId: recipient.id, error });
      }
    }
  }
  return { alerts, recoveries, summaries, failed };
}
