import assert from "node:assert/strict";
import test from "node:test";
import { createFacebookClient, FacebookRequestError } from "@/lib/facebook-client";
const config = { pageId: "123", accessToken: "private-test-token", apiVersion: "v25.0" };

test("Page identity is verified and posts use the Page feed with a private bearer token", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const client = createFacebookClient(config, async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json(requests.length === 1 ? { id: "123", name: "Card Show Nation" } : { id: "123_456" });
  });
  assert.deepEqual(await client.getPage(), { id: "123", name: "Card Show Nation" });
  assert.deepEqual(await client.publish("Kansas shows\nSee you there!"), { id: "123_456", url: "https://www.facebook.com/123_456" });
  assert.equal(requests[1].url, "https://graph.facebook.com/v25.0/123/feed");
  assert.equal(requests[1].init?.method, "POST");
  assert.equal(new Headers(requests[1].init?.headers).get("Authorization"), "Bearer private-test-token");
  assert.equal((requests[1].init?.body as URLSearchParams).get("message"), "Kansas shows\nSee you there!");
  assert.ok(requests.every((request) => !request.url.includes(config.accessToken)));
});

test("wrong Page tokens and unsafe config are rejected", async () => {
  const client = createFacebookClient(config, async () => Response.json({ id: "999", name: "Wrong Page" }));
  await assert.rejects(client.getPage(), /does not belong/);
  assert.throws(() => createFacebookClient({ ...config, pageId: "123/feed?token=" }), /invalid/);
});

test("Meta authorization errors are safe to retry and never leak the response", async () => {
  const client = createFacebookClient(config, async () => Response.json({ error: { code: 190, message: config.accessToken } }, { status: 400 }));
  await assert.rejects(client.publish("test"), (error: unknown) => {
    assert.ok(error instanceof FacebookRequestError);
    assert.equal(error.uncertain, false);
    assert.ok(!error.message.includes(config.accessToken));
    assert.match(error.message, /token expired or is invalid/);
    return true;
  });
});

test("ambiguous write failures cannot be automatically retried", async () => {
  const requests: typeof fetch[] = [
    async () => { throw new Error("lost connection"); },
    async () => new Response("bad gateway", { status: 502 }),
    async () => Response.json({ error: { code: 2 } }, { status: 503 }),
    async () => Response.json({ success: true }),
    async () => Response.json(null),
  ];
  for (const request of requests) {
    await assert.rejects(createFacebookClient(config, request).publish("test"), (error: unknown) => error instanceof FacebookRequestError && error.uncertain);
  }
});
