import assert from "node:assert/strict";
import test from "node:test";

process.env.EMAIL_SUPPRESSION_CHECK_DISABLED = "1";
import {
  getEmailConfigStatus,
  getFromAddress,
  sendFanEmailChangeNotice,
  sendFanEmailChangeVerificationEmail,
} from "./email";

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

test("sendFanEmailChangeVerificationEmail uses the configured sender", async () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;
  const originalFetch = global.fetch;
  const requests: any[] = [];

  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "Card Show Nation <noreply@cardshownation.com>";
  global.fetch = async (_input: any, init?: any) => {
    requests.push(JSON.parse(init?.body ?? "{}"));
    return new Response(JSON.stringify({ id: "email_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await sendFanEmailChangeVerificationEmail(
    "new@example.com",
    "old@example.com",
    "https://cardshownation.com/account/verify?token=abc"
  );

  assert.equal(requests[0]?.to, "new@example.com");
  assert.match(requests[0]?.subject ?? "", /confirm your new/i);
  assert.match(requests[0]?.html ?? "", /old@example.com/i);

  process.env.RESEND_API_KEY = originalApiKey;
  process.env.RESEND_FROM_EMAIL = originalFromEmail;
  global.fetch = originalFetch;
});

test("sendFanEmailChangeNotice uses the configured sender", async () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;
  const originalFetch = global.fetch;
  const requests: any[] = [];

  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM_EMAIL = "Card Show Nation <noreply@cardshownation.com>";
  global.fetch = async (_input: any, init?: any) => {
    requests.push(JSON.parse(init?.body ?? "{}"));
    return new Response(JSON.stringify({ id: "email_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await sendFanEmailChangeNotice("old@example.com", "new@example.com");

  assert.equal(requests[0]?.to, "old@example.com");
  assert.match(requests[0]?.subject ?? "", /email was changed/i);
  assert.match(requests[0]?.html ?? "", /new@example.com/i);

  process.env.RESEND_API_KEY = originalApiKey;
  process.env.RESEND_FROM_EMAIL = originalFromEmail;
  global.fetch = originalFetch;
});
