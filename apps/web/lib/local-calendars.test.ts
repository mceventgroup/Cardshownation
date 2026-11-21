import assert from "node:assert/strict";
import test from "node:test";
import { calendarDate, getDallasFortWorthCalendar, getWeekendCalendar } from "./local-calendars";

test("the Wisconsin calendar shows remaining weekend dates through midnight Central", () => {
  const beforeMonday = getWeekendCalendar(new Date("2026-11-23T05:59:59Z"));
  assert.equal(calendarDate(beforeMonday.friday), "2026-11-20");
  assert.equal(beforeMonday.from, "2026-11-22");
  assert.equal(beforeMonday.before, "2026-11-23");
  const monday = getWeekendCalendar(new Date("2026-11-23T06:00:00Z"));
  assert.equal(monday.from, "2026-11-27");
  assert.equal(monday.before, "2026-11-30");
});

test("date windows stay on Central calendar dates across UTC midnight and DST", () => {
  const weekend = getWeekendCalendar(new Date("2027-03-15T04:59:00Z"));
  assert.equal(weekend.from, "2027-03-14");
  assert.equal(weekend.before, "2027-03-15");
  assert.deepEqual(getDallasFortWorthCalendar(new Date("2026-11-22T03:00:00Z")), {
    from: "2026-11-21",
    before: "2027-02-19",
  });
});
