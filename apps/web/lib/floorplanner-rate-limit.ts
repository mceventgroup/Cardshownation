import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";

const FLOORPLANNER_MUTATION_LIMIT = {
  maxAttempts: 20,
  windowMs: 5 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
};

export async function enforceFloorplannerMutationRateLimit(userId: string) {
  const result = await consumeRateLimit(
    "floorplanner-mutation",
    userId,
    FLOORPLANNER_MUTATION_LIMIT,
  );
  if (result.allowed) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return NextResponse.json(
    { error: "Too many floorplanner changes. Wait a few minutes and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
