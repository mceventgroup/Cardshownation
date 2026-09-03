import assert from "node:assert/strict";
import test from "node:test";
import {
  NEARBY_LOCATION_MAX_AGE_MS,
  parseStoredNearbyLocation,
} from "@/lib/nearby-location";

test("accepts a valid short-lived rounded location", () => {
  const now = 1_800_000_000_000;
  assert.deepEqual(
    parseStoredNearbyLocation(
      JSON.stringify({ lat: 38.37, lng: -97.66, createdAt: now - 1_000 }),
      now,
    ),
    { lat: 38.37, lng: -97.66, createdAt: now - 1_000 },
  );
});

test("rejects expired, malformed, and out-of-range locations", () => {
  const now = 1_800_000_000_000;
  assert.equal(
    parseStoredNearbyLocation(
      JSON.stringify({ lat: 38.37, lng: -97.66, createdAt: now - NEARBY_LOCATION_MAX_AGE_MS - 1 }),
      now,
    ),
    null,
  );
  assert.equal(parseStoredNearbyLocation("not-json", now), null);
  assert.equal(
    parseStoredNearbyLocation(JSON.stringify({ lat: 100, lng: -97.66, createdAt: now }), now),
    null,
  );
});
