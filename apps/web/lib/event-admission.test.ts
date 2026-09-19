import assert from "node:assert/strict";
import test from "node:test";
import { getEventAdmissionPrice } from "./event-admission";

test("reads admission formats used by imports and submissions", () => {
  for (const value of ["USD 5", "$5", "5 USD", "5", " $5 admission "]) {
    assert.equal(getEventAdmissionPrice(false, value), 5, value);
  }
  assert.equal(getEventAdmissionPrice(false, "USD 12.50"), 12.5);
  assert.equal(getEventAdmissionPrice(false, "$7 weekend pass"), 7);
  assert.equal(getEventAdmissionPrice(false, "$1,000"), 1000);
});

test("only publishes zero for a known free price", () => {
  assert.equal(getEventAdmissionPrice(true, null), 0);
  assert.equal(getEventAdmissionPrice(false, "USD 0"), 0);
  for (const value of [null, undefined, "", "TBD", "Paid admission", "Kids under 12 free", "EUR 5", "5.123"]) {
    assert.equal(getEventAdmissionPrice(false, value), undefined, String(value));
  }
});
