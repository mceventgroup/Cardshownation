import assert from "node:assert/strict";
import test from "node:test";
import {
  formatApproximateLocation,
  getApproximateRequestLocation,
} from "@/lib/request-location";

test("reads Vercel's approximate request location headers", () => {
  const location = getApproximateRequestLocation(
    new Headers({
      "x-vercel-ip-city": "Kansas%20City",
      "x-vercel-ip-country-region": "MO",
      "x-vercel-ip-latitude": "39.0997",
      "x-vercel-ip-longitude": "-94.5786",
    })
  );

  assert.deepEqual(location, {
    lat: 39.0997,
    lng: -94.5786,
    city: "Kansas City",
    region: "MO",
  });
  assert.equal(formatApproximateLocation(location!), "Kansas City, MO");
});

test("rejects missing or out-of-range coordinates", () => {
  assert.equal(
    getApproximateRequestLocation(
      new Headers({
        "x-vercel-ip-latitude": "91",
        "x-vercel-ip-longitude": "-94.5786",
      })
    ),
    null
  );
  assert.equal(getApproximateRequestLocation(new Headers()), null);
});
