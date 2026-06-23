import assert from "node:assert/strict";
import test from "node:test";
import { serializeJsonLd } from "./safe-json-ld";
import { assertPublicHttpUrl } from "./safe-remote-fetch";
import { readJsonBodyLimited, RequestTooLargeError } from "./request-json";

test("serializeJsonLd prevents closing the script element", () => {
  const output = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
  assert.equal(output.includes("</script>"), false);
  assert.match(output, /\\u003c\/script/);
});

test("remote URL validation rejects private network addresses", async () => {
  await assert.rejects(() => assertPublicHttpUrl("http://127.0.0.1/admin"), /private|reserved/i);
  await assert.rejects(() => assertPublicHttpUrl("http://169.254.169.254/latest/meta-data"), /private|reserved/i);
  await assert.rejects(() => assertPublicHttpUrl("http://[::1]/"), /not allowed|private|reserved/i);
});

test("limited JSON reader rejects oversized request bodies", async () => {
  const request = new Request("https://cardshownation.com/api/test", {
    method: "POST",
    body: JSON.stringify({ value: "x".repeat(100) }),
  });
  await assert.rejects(() => readJsonBodyLimited(request, 32), RequestTooLargeError);
});
