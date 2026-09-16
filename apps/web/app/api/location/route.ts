import { NextRequest, NextResponse } from "next/server";
import { createIpStateLookup, getRequestState } from "@/lib/ip-state";
import { getRequestIp } from "@/lib/request-ip";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Reports only the current visitor's detection, for troubleshooting mismatched
// estimates. Never cache or log IPs, and never accept an arbitrary IP parameter.
export async function GET(request: NextRequest) {
  const ip = getRequestIp(request.headers);
  const rate = await consumeRateLimit("location-check", ip ?? "unknown", {
    maxAttempts: 10, windowMs: 60_000, blockMs: 60_000,
  });
  const responseHeaders = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
  if (!rate.allowed) return NextResponse.json({ error: "Try again shortly." }, { status: 429, headers: responseHeaders });
  let providerStatus: number | null = null;
  let providerError: string | null = null;
  const lookup = createIpStateLookup(async (url, options) => {
    try {
      const response = await fetch(url, options);
      providerStatus = response.status;
      return response;
    } catch (error) {
      providerError = error instanceof Error ? error.name : "LookupError";
      throw error;
    }
  });
  const state = await getRequestState(request.headers, lookup);
  return NextResponse.json({
    ip, state: state?.code ?? null,
    hostingState: request.headers.get("x-vercel-ip-country-region"),
    providerStatus, providerError,
  }, { headers: responseHeaders });
}
