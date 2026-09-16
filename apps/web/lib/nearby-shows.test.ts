import assert from "node:assert/strict";
import test from "node:test";
import { filterShowsByCityDistance } from "@/lib/nearby-shows";

test("nearby results cross state borders but exclude distant and unknown cities", () => {
  const results = filterShowsByCityDistance([
    { city: "Kansas City", state: "MO" },
    { city: "Overland Park", state: "KS" },
    { city: "Los Angeles", state: "CA" },
    { city: "Unknown city", state: "MO" },
  ], 39.0997, -94.5786, 100);
  assert.deepEqual(results.map((show) => show.state), ["MO", "KS"]);
  assert.equal(results[0].distanceMiles, 0);
  assert.ok(results[1].distanceMiles > 0 && results[1].distanceMiles < 100);
});

test("a smaller radius excludes cities outside it", () => {
  assert.deepEqual(filterShowsByCityDistance([
    { city: "Overland Park", state: "KS" },
  ], 39.0997, -94.5786, 1), []);
});
