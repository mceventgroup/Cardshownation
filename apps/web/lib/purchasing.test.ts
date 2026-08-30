import assert from "node:assert/strict";
import test from "node:test";
import { isPurchasingEnabled } from "@/lib/purchasing";

test("purchasing stays off unless explicitly enabled", () => {
  const original = process.env.PURCHASING_ENABLED;

  delete process.env.PURCHASING_ENABLED;
  assert.equal(isPurchasingEnabled(), false);

  process.env.PURCHASING_ENABLED = "false";
  assert.equal(isPurchasingEnabled(), false);

  process.env.PURCHASING_ENABLED = "true";
  assert.equal(isPurchasingEnabled(), true);

  if (original === undefined) delete process.env.PURCHASING_ENABLED;
  else process.env.PURCHASING_ENABLED = original;
});
