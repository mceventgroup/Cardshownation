import test from "node:test";
import assert from "node:assert/strict";
import { formatVerifiedDate, getPublicSourceLabel } from "./show-provenance";

test("public source labels explain provenance without exposing internal systems", () => {
  assert.equal(getPublicSourceLabel("MANUAL"), "Entered by Card Show Nation");
  assert.equal(getPublicSourceLabel("SUBMITTED"), "Submitted by a promoter or community member");
  assert.equal(getPublicSourceLabel("IMPORTED"), "Collected from a public event source");
});

test("verification dates are stable date-only labels", () => {
  assert.equal(formatVerifiedDate(null), "Verification pending");
  assert.equal(formatVerifiedDate(new Date("2026-09-18T00:00:00.000Z")), "September 18, 2026");
});
