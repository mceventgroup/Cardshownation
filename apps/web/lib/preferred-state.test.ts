import assert from "node:assert/strict";
import test from "node:test";
import { normalizePreferredState } from "@/lib/preferred-state";

test("normalizes a valid preferred state and rejects other values", () => {
  assert.equal(normalizePreferredState("ks"), "KS");
  assert.equal(normalizePreferredState("Kansas"), null);
  assert.equal(normalizePreferredState("XX"), null);
  assert.equal(normalizePreferredState(null), null);
});
