import assert from "node:assert/strict";
import test from "node:test";

process.env.CSN_DATA_MODE = "fixture";

test("fixture rate limits allow the configured number of attempts and then block", async () => {
  const { consumeRateLimit, resetRateLimit } = await import("./rate-limit");
  const scope = "test-limit";
  const key = `key-${Date.now()}`;
  const options = { maxAttempts: 2, windowMs: 60_000, blockMs: 30_000 };

  await resetRateLimit(scope, key);
  assert.equal((await consumeRateLimit(scope, key, options)).allowed, true);
  assert.equal((await consumeRateLimit(scope, key, options)).allowed, true);

  const blocked = await consumeRateLimit(scope, key, options);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);

  await resetRateLimit(scope, key);
  assert.equal((await consumeRateLimit(scope, key, options)).allowed, true);
});
