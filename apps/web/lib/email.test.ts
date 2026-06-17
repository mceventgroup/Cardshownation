import assert from "node:assert/strict";
import test from "node:test";
import { getEmailConfigStatus, getFromAddress } from "./email";

test("getFromAddress prefers explicit Resend sender env vars", () => {
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;
  const originalFromAddress = process.env.RESEND_FROM_ADDRESS;

  process.env.RESEND_FROM_EMAIL = "Card Show Nation <noreply@cardshownation.com>";
  process.env.RESEND_FROM_ADDRESS = "Card Show Nation <ignored@example.com>";

  assert.equal(getFromAddress(), "Card Show Nation <noreply@cardshownation.com>");

  process.env.RESEND_FROM_EMAIL = "";
  assert.equal(getFromAddress(), "Card Show Nation <ignored@example.com>");

  process.env.RESEND_FROM_EMAIL = originalFromEmail;
  process.env.RESEND_FROM_ADDRESS = originalFromAddress;
});

test("getFromAddress falls back to Resend onboarding sender", () => {
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;
  const originalFromAddress = process.env.RESEND_FROM_ADDRESS;

  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.RESEND_FROM_ADDRESS;

  assert.equal(getFromAddress(), "Card Show Nation <onboarding@resend.dev>");

  process.env.RESEND_FROM_EMAIL = originalFromEmail;
  process.env.RESEND_FROM_ADDRESS = originalFromAddress;
});

test("getEmailConfigStatus reports missing Resend API keys", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;

  process.env.RESEND_API_KEY = "";
  process.env.RESEND_FROM_EMAIL = "Card Show Nation <noreply@cardshownation.com>";

  assert.deepEqual(getEmailConfigStatus(), {
    ready: false,
    error: "Email sending is not configured: set RESEND_API_KEY.",
  });

  process.env.RESEND_API_KEY = originalApiKey;
  process.env.RESEND_FROM_EMAIL = originalFromEmail;
});

test("getEmailConfigStatus rejects personal inbox senders", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;

  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "Card Show Nation <cardshownation@gmail.com>";

  assert.deepEqual(getEmailConfigStatus(), {
    ready: false,
    error:
      "Email sending is not configured: RESEND_FROM_EMAIL must use a verified sending domain, not a personal inbox address.",
  });

  process.env.RESEND_API_KEY = originalApiKey;
  process.env.RESEND_FROM_EMAIL = originalFromEmail;
});
