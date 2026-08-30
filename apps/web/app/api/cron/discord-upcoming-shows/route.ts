import { NextRequest, NextResponse } from "next/server";
import { runDiscordUpcomingShowsSync } from "@/lib/discord-upcoming-shows-runner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
  const provided = bearerToken ?? request.headers.get("x-cron-secret");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await runDiscordUpcomingShowsSync()) });
  } catch (error) {
    console.error("[discord upcoming shows] synchronization failed", error);
    return NextResponse.json({ error: "Discord synchronization failed." }, { status: 502 });
  }
}
