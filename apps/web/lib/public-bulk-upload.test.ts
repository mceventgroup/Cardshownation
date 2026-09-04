import assert from "node:assert/strict";
import test from "node:test";
import { getMissingBulkHeaders, validatePublicBulkRows } from "./public-bulk-upload";

test("bulk upload identifies missing required columns", () => {
  assert.deepEqual(getMissingBulkHeaders(["title", "startDate", "city", "state"]), ["venueName"]);
});

test("bulk upload validates rows and normalizes optional values", () => {
  const result = validatePublicBulkRows([{
    rowNumber: 2,
    title: "Wichita Card Show",
    startDate: "2027-03-12",
    city: "Wichita",
    state: "ks",
    venueName: "Century II",
    categories: "Sports Cards|Pokemon",
    isFree: "yes",
    tableCount: "80",
    websiteUrl: "cardshownation.com",
  }]);

  assert.equal(result.errors.length, 0);
  assert.equal(result.validRows.length, 1);
  assert.equal(result.validRows[0].payload.endDate, "2027-03-12");
  assert.equal(result.validRows[0].payload.state, "KS");
  assert.equal(result.validRows[0].payload.isFree, true);
  assert.deepEqual(result.validRows[0].payload.categories, ["Sports Cards", "Pokemon"]);
});

test("bulk upload rejects malformed and repeated rows", () => {
  const base = {
    title: "Wichita Card Show",
    startDate: "2027-03-12",
    city: "Wichita",
    state: "KS",
    venueName: "Century II",
  };
  const result = validatePublicBulkRows([
    { rowNumber: 2, ...base },
    { rowNumber: 3, ...base },
    { rowNumber: 4, ...base, startDate: "03/12/2027" },
  ]);

  assert.equal(result.validRows.length, 1);
  assert.deepEqual(result.errors.map((error) => error.row), [3, 4]);
});
