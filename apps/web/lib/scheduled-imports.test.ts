import assert from "node:assert/strict";
import test from "node:test";
import { summarizeImportHealth } from "./scheduled-imports";
import { getImportHealthNotificationType } from "./import-health-alerts";

const now = new Date("2026-09-03T12:00:00.000Z");

function log(daysAgo: number, imported: number, skipped: number, errors = 0) {
  return {
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000),
    imported,
    skipped,
    errors,
    errorDetails: errors ? "Source request failed" : null,
  };
}

test("source health flags repeated empty scans that may indicate a layout change", () => {
  const health = summarizeImportHealth("premier-card-shows", [log(1, 0, 0), log(8, 0, 0)], now);
  assert.equal(health.status, "empty");
  assert.equal(health.consecutiveEmptyRuns, 2);
  assert.match(health.statusNote ?? "", /layout may have changed/i);
});

test("source health distinguishes failed and overdue scans", () => {
  assert.equal(summarizeImportHealth("comc", [log(1, 0, 0, 1)], now).status, "attention");
  assert.equal(summarizeImportHealth("gas-shows", [log(9, 2, 10)], now).status, "stale");
});

test("TCDB is not treated as broken when its incremental scan has no new records", () => {
  assert.equal(summarizeImportHealth("tcdb", [log(1, 0, 0), log(8, 0, 0)], now).status, "healthy");
});

test("source health notifications fire only for state changes and recovery", () => {
  assert.equal(getImportHealthNotificationType(null, "healthy"), null);
  assert.equal(getImportHealthNotificationType(null, "attention"), "problem");
  assert.equal(getImportHealthNotificationType("attention", "attention"), null);
  assert.equal(getImportHealthNotificationType("attention", "healthy"), "recovered");
  assert.equal(getImportHealthNotificationType("never", "healthy"), null);
});
