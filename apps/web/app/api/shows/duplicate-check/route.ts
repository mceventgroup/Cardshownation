import { NextRequest, NextResponse } from "next/server";
import { getPublicDuplicatePreview } from "@/lib/submissions";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { readJsonBodyLimited, RequestTooLargeError } from "@/lib/request-json";

const ALLOWED_FIELDS = [
  "showName", "startDate", "endDate", "city", "state", "venueName", "venueAddress",
  "description", "websiteUrl", "facebookUrl", "tableCount", "startTimeLabel", "endTimeLabel",
  "admissionPrice", "admissionNotes", "vendorDetails", "parkingInfo", "categories", "isFree",
] as const;

function sanitizePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    const fieldValue = input[field];
    if (typeof fieldValue === "string") payload[field] = fieldValue.slice(0, 4000);
    else if (typeof fieldValue === "boolean") payload[field] = fieldValue;
    else if (Array.isArray(fieldValue)) payload[field] = fieldValue.filter((item): item is string => typeof item === "string").slice(0, 12);
  }
  return payload;
}

export async function POST(request: NextRequest) {
  const rateLimit = await consumeRateLimit("public-duplicate-check", getRequestIp(request.headers) ?? "unknown", {
    blockMs: 15 * 60 * 1000,
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return NextResponse.json({ matches: [], error: "rate" }, { status: 429 });

  try {
    const body = await readJsonBodyLimited<{ shows?: Array<{ rowNumber?: unknown; payload?: unknown }> }>(request, 300 * 1024);
    if (!Array.isArray(body.shows) || body.shows.length === 0 || body.shows.length > 100) {
      return NextResponse.json({ matches: [], error: "invalid" }, { status: 400 });
    }

    const shows = body.shows.flatMap((item, index) => {
      const payload = sanitizePayload(item?.payload);
      if (!payload) return [];
      const rowNumber = typeof item.rowNumber === "number" && Number.isInteger(item.rowNumber) ? item.rowNumber : index + 1;
      return [{ rowNumber, payload }];
    });
    const matches: Array<{ rowNumber: number; match: Awaited<ReturnType<typeof getPublicDuplicatePreview>> }> = [];
    for (let index = 0; index < shows.length; index += 8) {
      const batch = shows.slice(index, index + 8);
      matches.push(...await Promise.all(batch.map(async (show) => ({
        rowNumber: show.rowNumber,
        match: await getPublicDuplicatePreview(show.payload),
      }))));
    }
    return NextResponse.json({ matches });
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return NextResponse.json({ matches: [], error: "too_large" }, { status: 413 });
    }
    return NextResponse.json({ matches: [], error: "invalid" }, { status: 400 });
  }
}
