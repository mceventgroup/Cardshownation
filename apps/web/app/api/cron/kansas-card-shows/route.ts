import { NextRequest, NextResponse } from "next/server";
import { runKansasCardShowImport } from "@/lib/kansas-card-show-import";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  if ((bearer ?? request.headers.get("x-cron-secret")) !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runKansasCardShowImport();
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
