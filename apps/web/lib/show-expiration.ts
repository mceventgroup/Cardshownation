import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";

export async function expirePastShows(now = new Date()) {
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const candidates = await db.show.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { expiresAt: { lt: now } },
        { expiresAt: null, endDate: { lt: startOfToday } },
      ],
    },
    select: { id: true },
  });
  if (!candidates.length) return { expired: 0 };
  const ids = candidates.map(({ id }) => id);
  const result = await db.show.updateMany({ where: { id: { in: ids }, status: "APPROVED" }, data: { status: "EXPIRED" } });
  await writeAuditLog({ action: "shows.expired", targetType: "Show", details: { count: result.count, ids: ids.slice(0, 100) } });
  return { expired: result.count };
}
