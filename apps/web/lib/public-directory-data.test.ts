import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDirectoryOptions, restoreShowCardDates } from "./public-directory-data";
import type { ShowCard } from "@/types";

test("directory cache keys share equivalent requests and separate filters and pages", () => {
  const key = (options: Parameters<typeof normalizeDirectoryOptions>[0]) => JSON.stringify(normalizeDirectoryOptions(options));
  assert.equal(key({ state: "KS", limit: 24 }), key({ limit: 24, state: "KS", offset: 0 }));
  assert.equal(key({}), key({ q: "", city: "", category: "", state: "" }));
  for (const filter of [{ state: "KS" }, { city: "Wichita" }, { q: "Pokemon" }, { isFree: false }, { isFree: true }, { limit: 8 }, { offset: 24 }, { category: "TCG" }]) {
    assert.notEqual(key({}), key(filter));
  }
});

test("cached JSON dates are restored without mutating shared rows", () => {
  const row = { id: "show", title: "Show", startDate: new Date("2026-11-02T00:00:00Z"), endDate: new Date("2026-11-03T00:00:00Z") } as ShowCard;
  const stored = JSON.parse(JSON.stringify([row])) as ShowCard[];
  const [restored] = restoreShowCardDates(stored);
  assert.equal(restored.startDate.toISOString(), row.startDate.toISOString());
  assert.equal(restored.endDate.getTime(), row.endDate.getTime());
  assert.equal(typeof stored[0].startDate, "string");
  assert.notEqual(restored, stored[0]);
});
