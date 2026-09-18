import assert from "node:assert/strict";
import test from "node:test";
import { buildFacebookRoundups, roundupPresets, roundupToday, validateRoundupRange, type RoundupShow } from "@/lib/facebook-roundups";

const now = new Date("2026-09-16T20:00:00Z");
const range = { start: "2026-09-16", end: "2026-09-20" };
function show(overrides: Partial<RoundupShow> = {}): RoundupShow {
  return { id: "one", slug: "wichita-show", title: "Wichita Card Show", city: "Wichita", state: "KS", status: "APPROVED",
    startDate: new Date("2026-09-19T00:00:00Z"), endDate: new Date("2026-09-19T00:00:00Z"),
    expiresAt: null, startTimeLabel: "9:00 AM", endTimeLabel: "4:00 PM", venue: { name: "Convention Center" }, ...overrides };
}

test("weekly presets use Central time at midnight, Sundays, year boundaries and DST", () => {
  assert.equal(roundupToday(new Date("2026-09-17T02:00:00Z")), "2026-09-16");
  assert.deepEqual(roundupPresets(now).thisWeek, range);
  assert.deepEqual(roundupPresets(new Date("2026-09-20T18:00:00Z")).thisWeek, { start: "2026-09-20", end: "2026-09-20" });
  assert.deepEqual(roundupPresets(new Date("2026-12-31T18:00:00Z")).nextWeek, { start: "2027-01-04", end: "2027-01-10" });
  assert.deepEqual(roundupPresets(new Date("2026-03-08T08:01:00Z")).nextSevenDays, { start: "2026-03-08", end: "2026-03-14" });
});

test("range validation rejects impossible, reversed, oversized and malformed dates", () => {
  for (const input of [ { start: "2026-02-30", end: "2026-03-01" }, { start: range.end, end: range.start },
    { start: "2026-01-01", end: "2026-02-01" }, { start: "tomorrow", end: range.end } ]) assert.ok(validateRoundupRange(input));
  assert.equal(validateRoundupRange({ start: "2028-02-29", end: "2028-02-29" }), null);
  assert.ok(validateRoundupRange(null as unknown as typeof range));
});

test("roundups exclude unapproved, expired and past shows; include overlapping multi-day shows", () => {
  const shows = [show(), show({ id: "pending", status: "PENDING" }), show({ id: "rejected", status: "REJECTED" }),
    show({ id: "expired", status: "EXPIRED" }), show({ id: "ttl", expiresAt: new Date("2026-09-16T19:00:00Z") }),
    show({ id: "past", endDate: new Date("2026-09-15T00:00:00Z"), startDate: new Date("2026-09-15T00:00:00Z") }),
    show({ id: "next", startDate: new Date("2026-09-21T00:00:00Z"), endDate: new Date("2026-09-21T00:00:00Z") }),
    show({ id: "ongoing", title: "Ongoing Show", startDate: new Date("2026-09-14T00:00:00Z"), endDate: new Date("2026-09-16T00:00:00Z") })];
  const result = buildFacebookRoundups(shows, range, "https://cardshownation.com", now);
  assert.equal(result.length, 1);
  assert.equal(result[0].showCount, 2);
  assert.ok(result[0].message.indexOf("Ongoing Show") < result[0].message.indexOf("Wichita Card Show"));
  assert.match(result[0].message, /Sat, Sep 19, 2026 \| 9:00 AM – 4:00 PM \(local time\)/);
  assert.doesNotMatch(result[0].message.split("Wichita Card Show")[0], /9:00 AM/);
});

test("states are grouped and sorted, links are canonical, empty states are omitted", () => {
  const result = buildFacebookRoundups([show(), show({ id: "ia", state: "ia", city: "Des Moines" }), show({ id: "xx", state: "XX" })], range, "https://cardshownation.com/", now);
  assert.deepEqual(result.map((item) => item.state), ["IA", "KS"]);
  assert.match(result[1].message, /https:\/\/cardshownation.com\/shows\/wichita-show/);
  assert.match(result[1].message, /https:\/\/cardshownation.com\/card-shows\/kansas/);
  assert.deepEqual(buildFacebookRoundups([], range, "https://cardshownation.com", now), []);
});

test("large state roundups are never silently capped or truncated", () => {
  const result = buildFacebookRoundups(Array.from({ length: 120 }, (_, index) => show({ id: String(index), title: `Show ${index}` })), range, "https://cardshownation.com", now);
  assert.equal(result[0].showCount, 120);
  assert.match(result[0].message, /Show 119/);
});
