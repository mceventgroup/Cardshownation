import assert from "node:assert/strict";
import test from "node:test";
import { runKansasCardShowImport } from "./kansas-card-show-import";
import { KANSAS_SHEET_LABEL, KANSAS_SHEET_SOURCE } from "./kansas-card-show-sheet";

const summary = { source: KANSAS_SHEET_SOURCE, label: KANSAS_SHEET_LABEL, imported: 0, enriched: 0, skipped: 0, errors: [] as string[] };

test("passes row validation issues to ingestion so they appear in the same import log", async () => {
  const errors = ["Published row 15: end date precedes start date."];
  const result = await runKansasCardShowImport({
    fetchSheet: async () => ({ rowsRead: 1, shows: [], errors }),
    ingest: async (input) => {
      assert.equal(input.source, KANSAS_SHEET_SOURCE);
      assert.deepEqual(input.sourceErrors, errors);
      return { ...summary, errors: input.sourceErrors ?? [] };
    },
    recordFailure: async () => { throw new Error("Unexpected fetch failure"); },
  });
  assert.deepEqual(result.errors, errors);
});

test("records inaccessible or empty sheets as failures without importing", async () => {
  for (const fetchSheet of [
    async () => { throw new Error("HTTP 403"); },
    async () => ({ rowsRead: 0, shows: [], errors: [] }),
  ]) {
    const result = await runKansasCardShowImport({
      fetchSheet,
      ingest: async () => { throw new Error("Must not ingest"); },
      recordFailure: async (input) => ({ ...summary, errors: [input.error] }),
    });
    assert.match(result.errors[0], /HTTP 403|no show rows/);
  }
});
