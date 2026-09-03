import { NextRequest, NextResponse } from "next/server";
import { expirePastShows } from "@/lib/show-expiration";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  if ((bearer ?? request.headers.get("x-cron-secret")) !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await expirePastShows());
}
