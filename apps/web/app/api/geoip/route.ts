import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp, isLocalIp } from "@/lib/request-ip";

function readCoordinate(value: string | null, min: number, max: number) {
  if (value === null) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
}

function readCity(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 120);
  } catch {
    return value.slice(0, 120);
  }
}

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

  const lat = readCoordinate(req.headers.get("x-vercel-ip-latitude"), -90, 90);
  const lng = readCoordinate(req.headers.get("x-vercel-ip-longitude"), -180, 180);
  if (lat === null || lng === null) {
    return NextResponse.json({ lat: null, lng: null, city: null, error: "unavailable" });
  }

  return NextResponse.json({
    lat,
    lng,
    city: readCity(req.headers.get("x-vercel-ip-city")),
    region: req.headers.get("x-vercel-ip-country-region")?.slice(0, 12) ?? null,
  });
}
