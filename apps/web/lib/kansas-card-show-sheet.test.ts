import assert from "node:assert/strict";
import test from "node:test";
import Papa from "papaparse";
import { KANSAS_SHEET_URL, parseKansasCardShowSheet } from "./kansas-card-show-sheet";

const headers = ["Card Show Name ", "Start Date", "End Date", "City", "State", "Venue Name / Location Name ", "Number of Tables/ Use a number only"];
const row = ["Kansas Card Show", "12/19/26", "12/20/2026", "Wichita", "Kansas", "Hyatt Regency", "150"];
const csv = (rows: string[][]) => Papa.unparse([headers, ...rows]);

test("imports every state and date with quoted commas, multiline venues, and mixed year formats", () => {
  const result = parseKansasCardShowSheet(csv([
    row,
    ['Collectors "First", Card Show', "7/24/2026", "7/25/26", "Springfield", " mo ", "Event Center, Hall A\nSecond floor", ""],
    ["TCG Weekend", "12/31/26", "1/1/27", "Tulsa", "Oklahoma", "", ""],
  ]));
  assert.equal(result.rowsRead, 3);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.shows.map((show) => show.state), ["KS", "MO", "OK"]);
  assert.equal(result.shows[0].startDate.toISOString(), "2026-12-19T00:00:00.000Z");
  assert.equal(result.shows[0].tableCount, 150);
  assert.equal(result.shows[1].venueName, "Event Center, Hall A\nSecond floor");
  assert.equal(result.shows[2].endDate.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(result.shows[0].sourceUrl, KANSAS_SHEET_URL);
  assert.equal(result.shows[0].websiteUrl, null);
  assert.equal(result.shows[0].organizerName, null);
  assert.equal(result.shows[0].isFree, false);
});

test("row order, whitespace, state spelling, end dates and table counts do not change identity", () => {
  const first = parseKansasCardShowSheet(csv([row])).shows[0];
  const moved = parseKansasCardShowSheet(csv([
    ["Another Show", "1/1/27", "", "Omaha", "NE", "", ""],
    [" Kansas   Card Show ", "12/19/2026", "12/21/26", " WICHITA ", "KS", "Updated venue", "160"],
  ])).shows[1];
  assert.equal(moved.externalId, first.externalId);
  const nextDate = [...row];
  nextDate[1] = "12/20/26";
  assert.notEqual(parseKansasCardShowSheet(csv([nextDate])).shows[0].externalId, first.externalId);
});

test("rejects invalid calendar dates, reversed ranges and unknown states while preserving valid rows", () => {
  const result = parseKansasCardShowSheet(csv([
    ["Impossible Date", "2/30/26", "", "Wichita", "KS"],
    ["Reversed Date", "8/1/26", "7/2/26", "Wichita", "KS"],
    ["Unknown State", "8/1/26", "", "Wichita", "ZZ"],
    row,
  ]));
  assert.equal(result.shows.length, 1);
  assert.equal(result.errors.length, 3);
  assert.match(result.errors[0], /Published row 2/);
  assert.match(result.errors[1], /Published row 3.*end date precedes/);
});

test("defaults blank end dates, reports invalid optional counts, and ignores blank rows", () => {
  const result = parseKansasCardShowSheet(csv([
    [],
    ["One Day", "2/29/28", "", "Wichita", "KS", "", "about 20"],
    ["Not Leap Year", "2/29/27", "", "Wichita", "KS"],
    [],
  ]));
  assert.equal(result.rowsRead, 2);
  assert.equal(result.shows.length, 1);
  assert.equal(result.shows[0].startDate.getTime(), result.shows[0].endDate.getTime());
  assert.equal(result.shows[0].tableCount, null);
  assert.match(result.errors[0], /row 3.*table count/);
});

test("maps reordered headers and handles BOM and trailing empty columns", () => {
  const result = parseKansasCardShowSheet("\uFEFF" + Papa.unparse([
    ["City", "State", "End Date", "Card Show Name ", "Start Date", "", ""],
    ["Wichita", "KS", "", "New Show", "9/12/26", "", ""],
  ]));
  assert.equal(result.shows[0].title, "New Show");
  assert.equal(result.shows[0].venueName, null);
});

test("fails visibly on login pages, missing or duplicated headers and malformed CSV", () => {
  assert.throws(() => parseKansasCardShowSheet("<html>Sign in</html>"), /required columns/);
  assert.throws(() => parseKansasCardShowSheet(Papa.unparse([[...headers, "City"], [...row, "Olathe"]])), /duplicate required/);
  assert.throws(() => parseKansasCardShowSheet(csv([row]) + '\r\n"unfinished'), /Unable to read Published CSV/);
});
