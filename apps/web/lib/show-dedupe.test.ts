import assert from "node:assert/strict";
import test from "node:test";
import { informationScore, isLikelyDuplicate, showMatchScore } from "./show-dedupe";

const base = { showName: "The Flint Hills Card Show", startDate: "2026-09-05", city: "Manhattan", state: "KS", venueName: "Peace Memorial Auditorium" };

test("matches title aliases on the same date and market", () => {
  assert.equal(isLikelyDuplicate(base, { ...base, showName: "Flint Hills Card Show" }), true);
  assert.equal(isLikelyDuplicate({ ...base, showName: "McPherson Sports Card and Memorabilia Show", city: "McPherson" }, { ...base, showName: "McPherson Sportscards & Memorabilia Show", city: "McPherson" }), true);
});

test("does not merge different dates, cities, or conflicting venues", () => {
  assert.equal(showMatchScore(base, { ...base, startDate: "2026-09-06" }), 0);
  assert.equal(showMatchScore(base, { ...base, city: "Wichita" }), 0);
  assert.equal(isLikelyDuplicate({ ...base, showName: "Collectors Showcase" }, { ...base, showName: "Collectors Showcase Weekend", venueName: "Completely Different Hotel" }), false);
  assert.equal(isLikelyDuplicate({ ...base, showName: "Card Show", venueName: "Hotel One" }, { ...base, showName: "Card Show", venueName: "Hotel Two" }), false);
});

test("recommends the record with more useful information", () => {
  assert.ok(informationScore({ ...base, venueAddress: "101 S 4th St", websiteUrl: "https://example.com" }) > informationScore(base));
});
