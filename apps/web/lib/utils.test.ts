import test from "node:test";
import assert from "node:assert/strict";
import { formatShowDate, getDateBadge } from "./utils";

test("formatShowDate renders a single date", () => {
  assert.equal(
    formatShowDate(new Date("2026-09-18T00:00:00.000Z"), new Date("2026-09-18T00:00:00.000Z")),
    "Sep 18, 2026"
  );
});

test("formatShowDate renders same-month ranges without malformed Intl output", () => {
  assert.equal(
    formatShowDate(new Date("2027-04-16T00:00:00.000Z"), new Date("2027-04-18T00:00:00.000Z")),
    "Apr 16–18, 2027"
  );
});

test("formatShowDate renders cross-month and cross-year ranges", () => {
  assert.equal(
    formatShowDate(new Date("2026-10-31T00:00:00.000Z"), new Date("2026-11-01T00:00:00.000Z")),
    "Oct 31–Nov 1, 2026"
  );
  assert.equal(
    formatShowDate(new Date("2026-12-31T00:00:00.000Z"), new Date("2027-01-01T00:00:00.000Z")),
    "Dec 31, 2026–Jan 1, 2027"
  );
});

test("date badges use UTC date-only values", () => {
  assert.deepEqual(
    getDateBadge(new Date("2027-04-16T00:00:00.000Z"), new Date("2027-04-18T00:00:00.000Z")),
    { month: "APR", weekday: "Fri", dayLabel: "16–18" }
  );
});
