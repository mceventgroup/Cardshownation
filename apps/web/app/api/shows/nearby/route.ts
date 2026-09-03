import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_NEARBY_RADIUS, normalizeNearbyRadius } from "@/lib/nearby-radius";
import { getNearbyShows } from "@/lib/shows";

export const dynamic = "force-dynamic";

function finiteCoordinate(value: unknown, min: number, max: number) {
  const number = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid location request." }, { status: 400 });
  }

  const lat = finiteCoordinate(body.lat, -90, 90);
  const lng = finiteCoordinate(body.lng, -180, 180);
  if (lat === null || lng === null) {
    return NextResponse.json({ error: "Invalid location." }, { status: 400 });
  }

  const radiusMiles = normalizeNearbyRadius(
    typeof body.radius === "string" || typeof body.radius === "number"
      ? body.radius
      : DEFAULT_NEARBY_RADIUS,
  );
  const shows = await getNearbyShows({ lat, lng, radiusMiles, limit: 50 });
  const response = NextResponse.json({ shows });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
