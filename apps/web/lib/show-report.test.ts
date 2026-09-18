import test from "node:test";
import assert from "node:assert/strict";
import { parsePublicShowReport } from "./show-report";

test("show reports accept known reasons and optional details", () => {
  const formData = new FormData();
  formData.set("reason", "venue");
  formData.set("details", "The venue moved across town.");
  assert.deepEqual(parsePublicShowReport(formData), {
    reason: "Venue or address is incorrect",
    details: "The venue moved across town.",
  });
});

test("other reports require details and oversized reports are rejected", () => {
  const missingDetails = new FormData();
  missingDetails.set("reason", "other");
  assert.equal(parsePublicShowReport(missingDetails), null);

  const oversized = new FormData();
  oversized.set("reason", "date_time");
  oversized.set("details", "x".repeat(1_001));
  assert.equal(parsePublicShowReport(oversized), null);
});
