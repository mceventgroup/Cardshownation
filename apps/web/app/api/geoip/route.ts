import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp, isLocalIp } from "@/lib/request-ip";
import { getApproximateRequestLocation } from "@/lib/request-location";

export async function GET(req: NextRequest) {
  const ip = getRequestIp(req.headers);

  if (isLocalIp(ip)) {
    return NextResponse.json({ lat: null, lng: null, city: null, error: "local" });
  }

  const rateLimit = await consumeRateLimit("geoip", ip ?? "unknown", {
    blockMs: 15 * 60 * 1000,
    maxAttempts: 30,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ lat: null, lng: null, error: "rate limited" }, { status: 429 });
  }

  const location = getApproximateRequestLocation(req.headers);
  if (!location) {
    return NextResponse.json({ lat: null, lng: null, city: null, error: "unavailable" });
  }

  return NextResponse.json(location);
}
