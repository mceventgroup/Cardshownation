import assert from "node:assert/strict";
import test from "node:test";
import { createIpStateLookup, getRequestState } from "@/lib/ip-state";

const ip = "198.51.100.19";
const headers = new Headers({
  "x-vercel-forwarded-for": ip,
  "x-real-ip": "198.51.100.20",
  "x-vercel-ip-country": "US",
  "x-vercel-ip-country-region": "NE",
});

test("looks up the actual visitor behind Cloudflare and never falls back to the proxy's state", async () => {
  const proxied = new Headers({
    "x-vercel-forwarded-for": "172.68.88.196", "cf-connecting-ip": ip,
    "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "NE",
  });
  assert.equal((await getRequestState(proxied, async (address) => {
    assert.equal(address, ip);
    return "KS";
  }))?.code, "KS");
  assert.equal(await getRequestState(proxied, async () => undefined), null);
  proxied.delete("cf-connecting-ip");
  assert.equal(await getRequestState(proxied, async () => { throw new Error("Never locate a proxy"); }), null);
});

test("uses the original visitor IP and prefers the independent state", async () => {
  const state = await getRequestState(headers, async (requestedIp) => {
    assert.equal(requestedIp, ip);
    return "KS";
  });
  assert.equal(state?.code, "KS");
});

test("provider failures fall back to the hosting state, not a city radius", async () => {
  assert.equal((await getRequestState(headers, async () => undefined))?.code, "NE");
  assert.equal(await getRequestState(new Headers()), null);
});

test("a non-US result does not reuse an incompatible hosting state", async () => {
  assert.equal(await getRequestState(headers, async () => null), null);
});

test("validates provider data, caches results and refreshes after expiry", async () => {
  let calls = 0;
  let time = 0;
  const lookup = createIpStateLookup(async (url, options) => {
    calls++;
    assert.equal(url, `https://get.geojs.io/v1/ip/geo/${ip}.json`);
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    return Response.json({ ip, country_code: "US", region: "Kansas", city: "Salina" });
  }, () => time);
  assert.equal(await lookup(ip), "KS");
  assert.equal(await lookup(ip), "KS");
  assert.equal(calls, 1);
  time += 15 * 60 * 1000;
  assert.equal(await lookup(ip), "KS");
  assert.equal(calls, 2);
});

test("invalid, failed, or mismatched responses never invent a state", async () => {
  for (const data of [null, [], {}, { ip, country_code: "US", region: "unknown" },
    { ip: "198.51.100.20", country_code: "US", region: "Kansas" }]) {
    assert.equal(await createIpStateLookup(async () => Response.json(data))(ip), undefined);
  }
  assert.equal(await createIpStateLookup(async () => new Response("", { status: 429 }))(ip), undefined);
  assert.equal(await createIpStateLookup(async () => { throw new Error("timeout"); })(ip), undefined);
});

test("different visitors behind the same proxy never share cached states", async () => {
  const addresses = ["198.51.100.19", "198.51.100.20"];
  const calls: string[] = [];
  const lookup = createIpStateLookup(async (url) => {
    const address = String(url).split("/").at(-1)!.replace(".json", "");
    calls.push(address);
    return Response.json({ ip: address, country_code: "US", region: address === addresses[0] ? "Kansas" : "New York" });
  });
  for (const [address, expected] of [[addresses[0], "KS"], [addresses[1], "NY"], [addresses[0], "KS"]]) {
    const proxied = new Headers({ "x-vercel-forwarded-for": "172.68.88.196", "cf-connecting-ip": address });
    assert.equal((await getRequestState(proxied, lookup))?.code, expected);
  }
  assert.deepEqual(calls, addresses);
});

test("country is checked before matching state names", async () => {
  assert.equal(await createIpStateLookup(async () => Response.json({
    ip, country_code: "BR", region: "PA",
  }))(ip), null);
});

test("private, local, and malformed IPs never leave the server", async () => {
  let calls = 0;
  const lookup = createIpStateLookup(async () => { calls++; throw new Error("Must not fetch"); });
  for (const candidate of ["", "garbage", "1:2:3", "127.0.0.2", "10.1.1.1", "192.168.1.1",
    "172.20.0.1", "169.254.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::", "::1", "fd00::1"]) {
    assert.equal(await lookup(candidate), undefined);
  }
  assert.equal(calls, 0);
});
