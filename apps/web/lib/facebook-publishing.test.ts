import assert from "node:assert/strict";
import test from "node:test";
import { FacebookRequestError } from "@/lib/facebook-client";
import { publishReservedFacebookPost, type FacebookPublishStore } from "@/lib/facebook-publishing";

function store() {
  const state = { status: "", postId: "" };
  const methods: FacebookPublishStore = {
    async reserve() { if (state.status && state.status !== "FAILED") return false; state.status = "PUBLISHING"; return true; },
    async published(id) { state.status = "PUBLISHED"; state.postId = id; },
    async failed(status) { state.status = status; },
  };
  return { state, methods };
}
const post = { id: "123_456", url: "https://www.facebook.com/123_456" };

test("concurrent and repeated requests publish only once", async () => {
  const { state, methods } = store();
  let calls = 0;
  const publish = async () => { calls++; return post; };
  const results = await Promise.all([publishReservedFacebookPost(methods, publish), publishReservedFacebookPost(methods, publish)]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(calls, 1);
  assert.equal(state.postId, post.id);
  await publishReservedFacebookPost(methods, publish);
  assert.equal(calls, 1);
});

test("an explicit rejection releases the reservation for a deliberate retry", async () => {
  const { state, methods } = store();
  const result = await publishReservedFacebookPost(methods, async () => { throw new FacebookRequestError("Permission denied"); });
  assert.deepEqual(result, { ok: false, blocked: false, error: "Permission denied" });
  assert.equal(state.status, "FAILED");
  assert.equal((await publishReservedFacebookPost(methods, async () => post)).ok, true);
});

test("unknown results stay locked even after a second request", async () => {
  const { state, methods } = store();
  let calls = 0;
  const publish = async () => { calls++; throw new FacebookRequestError("Unknown result", true); };
  await publishReservedFacebookPost(methods, publish);
  assert.equal(state.status, "UNKNOWN");
  await publishReservedFacebookPost(methods, publish);
  assert.equal(calls, 1);
});

test("receipt write failures preserve the live post link and never unlock the reservation", async () => {
  const { state, methods } = store();
  methods.published = async () => { throw new Error("database unavailable"); };
  const result = await publishReservedFacebookPost(methods, async () => post);
  assert.deepEqual(result, { ok: true, url: post.url });
  assert.equal(state.status, "PUBLISHING");
  assert.equal((await publishReservedFacebookPost(methods, async () => { throw new Error("must not run"); })).ok, false);
});

test("database reservation failures never reach Facebook", async () => {
  const { methods } = store();
  methods.reserve = async () => { throw new Error("offline"); };
  let called = false;
  await assert.rejects(publishReservedFacebookPost(methods, async () => { called = true; return post; }), /offline/);
  assert.equal(called, false);
});
