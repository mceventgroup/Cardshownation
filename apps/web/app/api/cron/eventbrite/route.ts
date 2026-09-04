import { NextRequest, NextResponse } from "next/server";
import { runScheduledImports } from "@/lib/scheduled-imports";
import { runImportHealthNotifications } from "@/lib/import-health-alerts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authorization = req.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
  const provided = bearerToken ?? req.headers.get("x-cron-secret");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledImports();
  let notifications = { alerts: 0, recoveries: 0, summaries: 0, failed: 0 };
  try {
    notifications = await runImportHealthNotifications();
  } catch (error) {
    notifications.failed += 1;
    console.error("[import health] notification check failed after scheduled import", error);
  }
  return NextResponse.json({ ...result, notifications });
}
