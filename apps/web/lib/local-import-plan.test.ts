import assert from "node:assert/strict";
import test from "node:test";
import { candidateRecord, centralToday, planLocalImport, validateImportedShow, type SnapshotRecord } from "./local-import-plan";
import type { ImportedShow } from "./show-import-ingest";

const show: ImportedShow = { externalId: "test-1", title: "Wichita Card Show", startDate: new Date("2026-11-10"), endDate: new Date("2026-11-10"), city: "Wichita", state: "KS", venueName: "Civic Center", venueAddress: "100 Main", venueLat: null, venueLng: null, description: null, isFree: false, admissionPrice: null, websiteUrl: null, categories: ["Sports Cards"], organizerName: null };
const record = (status = "APPROVED"): SnapshotRecord => ({ id: "stored", kind: "show", status, record: { ...candidateRecord(show, "test"), source: "test" } });

test("unchanged scans and cross-source duplicates send no writes", () => {
  assert.equal(planLocalImport("test", [show], [record()], "2026-10-02").changes.length, 0);
  assert.equal(planLocalImport("other", [show], [record()], "2026-10-02").changes.length, 0);
});
test("new records are deduplicated within a scan and future scans are idempotent", () => {
  const records: SnapshotRecord[] = [];
  assert.equal(planLocalImport("test", [show, show], records, "2026-10-02").changes.length, 1);
  assert.equal(planLocalImport("test", [show], records, "2026-10-02").changes.length, 0);
});
test("enrichments fill gaps and rejected identities stay rejected", () => {
  const richer = { ...show, description: "Verified details" };
  assert.equal(planLocalImport("test", [richer], [record()], "2026-10-02").changes.length, 1);
  assert.equal(planLocalImport("test", [richer], [record("REJECTED")], "2026-10-02").changes.length, 0);
});
test("validated pending source records can resume interrupted approval", () => {
  assert.equal(planLocalImport("test", [show], [record("PENDING")], "2026-10-02").changes.length, 1);
});
test("expired shows, invalid states, malformed data and public TCDB links are blocked", () => {
  assert.equal(planLocalImport("test", [show], [], "2026-12-01").expired, 1);
  assert.throws(() => validateImportedShow({ ...show, state: "XX" }, "test", "2026-10-02"));
  assert.throws(() => validateImportedShow({ ...show, title: 4 }, "test", "2026-10-02"));
  assert.throws(() => validateImportedShow({ ...show, facebookUrl: "https://tcdb.com/show" }, "tcdb", "2026-10-02"));
  assert.equal(validateImportedShow({ ...show, websiteUrl: "https://tcdb.com/show" }, "tcdb", "2026-10-02").websiteUrl, null);
});
test("Central dates retain an event through its local day", () => {
  assert.equal(centralToday(new Date("2026-10-03T01:00:00Z")), "2026-10-02");
});
test("trade nights are held for review instead of being merged into a same-venue show", () => {
  assert.equal(planLocalImport("other", [{ ...show, title: "Wichita Card Show Trade Night" }], [record()], "2026-10-02").ambiguous.length, 1);
});
test("calendar feeds can omit categories and attach different times to same-day dates", () => {
  const parsed = validateImportedShow({ ...show, categories: [], startDate: new Date("2026-11-10T12:00:00Z"), endDate: new Date("2026-11-10T00:00:00Z") }, "test", "2026-10-02");
  assert.deepEqual(parsed.categories, []);
  assert.equal(parsed.endDate.toISOString().slice(0, 10), "2026-11-10");
});
