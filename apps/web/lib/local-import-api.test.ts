import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

function stub(t: TestContext, target: any, key: string, implementation: (...args: any[]) => any) {
  const original = target[key];
  let calls = 0;
  target[key] = (...args: any[]) => { calls++; return implementation(...args); };
  t.after(() => { target[key] = original; });
  return { mock: { callCount: () => calls } };
}

process.env.DATABASE_URL = "postgresql://user@localhost:5432/csn";
process.env.CSN_DATA_MODE = "live";
process.env.CRON_SECRET = "test-local-import-secret";
const load = async () => ({ route: await import("../app/api/automation/imports/route"), db: (await import("./db")).db });
const request = (body?: unknown, authorized = true) => new Request("https://www.cardshownation.com/api/automation/imports", { method: body ? "POST" : "GET", headers: authorized ? { Authorization: "Bearer test-local-import-secret" } : {}, body: body ? JSON.stringify(body) : undefined });

test("unauthenticated reads and writes never query the database", async (t) => {
  const { route, db } = await load();
  const query = stub(t, db.show, "findMany", () => { throw new Error("Must not query"); });
  assert.equal((await route.GET(request(undefined, false))).status, 401);
  assert.equal((await route.POST(request({ source: "tcdb" }, false))).status, 401);
  assert.equal(query.mock.callCount(), 0);
});
test("snapshot excludes submitter identity and claim controls", async (t) => {
  const { route, db } = await load();
  stub(t, db.show, "findMany", async () => []);
  stub(t, db.autoImportSource, "findMany", async () => []);
  stub(t, db.showSubmission, "findMany", async () => [{ id: "pending", status: "PENDING", reviewedShowId: null, payloadJson: { showName: "Public show", source: "tcdb", externalId: "123", organizerEmail: "private@example.com", claimTargetShowId: "private-show", publicPromoterEmail: "private@example.com" } }]);
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(body.includes("Public show"));
  assert.ok(!body.includes("private@example.com"));
  assert.ok(!body.includes("claimTargetShowId"));
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("malformed batches are rejected before any writes", async (t) => {
  const { route, db } = await load();
  stub(t, db.autoImportSource, "findMany", async () => []);
  const write = stub(t, db.showSubmission, "create", () => { throw new Error("Must not write"); });
  assert.equal((await route.POST(request({ source: "unknown", label: "Unknown", batchId: "a", shows: [] }))).status, 400);
  assert.equal((await route.POST(request({ source: "tcdb", label: "TCDB", batchId: "a", shows: [{}] }))).status, 400);
  assert.equal((await route.POST(request({ source: "tcdb", label: "TCDB", batchId: "a", shows: Array(26).fill({}) }))).status, 400);
  assert.equal(write.mock.callCount(), 0);
});
test("a repeated source report replays its receipt without another log", async (t) => {
  const { route, db } = await load();
  stub(t, db.autoImportSource, "findMany", async () => []);
  stub(t, db.auditLog, "findFirst", async () => ({ details: { ok: true, recorded: true, published: 2 } }));
  const write = stub(t, db.importLog, "create", () => { throw new Error("Must not log twice"); });
  const result = await route.POST(request({ source: "tcdb", label: "TCDB", batchId: "run:tcdb:report", report: { imported: 2, skipped: 300, errors: [] } }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).published, 2);
  assert.equal(write.mock.callCount(), 0);
});
