import { NextRequest, NextResponse } from "next/server";
import { getPublicUpcomingShows as getUpcomingShows } from "@/lib/public-directory";

// Public JSON API — for future mobile app consumption
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "24")));
  const offset = (page - 1) * limit;

  const { shows, total } = await getUpcomingShows({
    state: searchParams.get("state") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    isFree: searchParams.get("free") === "1" ? true : undefined,
    q: searchParams.get("q") ?? undefined,
    limit,
    offset,
  });

  return NextResponse.json({
    shows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
