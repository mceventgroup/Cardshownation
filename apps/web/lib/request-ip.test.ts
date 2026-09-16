import assert from "node:assert/strict";
import test from "node:test";
import { getRequestIp } from "@/lib/request-ip";

test("reads the visitor IP through Cloudflare in front of Vercel", () => {
  assert.equal(getRequestIp(new Headers({
    "x-vercel-forwarded-for": "172.68.88.196",
    "x-real-ip": "172.68.88.196",
    "cf-connecting-ip": "198.51.100.19",
  })), "198.51.100.19");
});

test("direct traffic cannot spoof the Cloudflare header", () => {
  assert.equal(getRequestIp(new Headers({
    "x-vercel-forwarded-for": "198.51.100.20",
    "cf-connecting-ip": "198.51.100.19",
  })), "198.51.100.20");
});

test("accepts genuine IPv6 proxy networks and rejects malformed IPs", () => {
  assert.equal(getRequestIp(new Headers({
    "x-vercel-forwarded-for": "2606:4700::1",
    "cf-connecting-ip": "2001:db8::19",
  })), "2001:db8::19");
  assert.equal(getRequestIp(new Headers({ "x-real-ip": "1:2:3" })), null);
  assert.equal(getRequestIp(new Headers({ "x-real-ip": "999.1.1.1" })), null);
});

test("missing or invalid Cloudflare client headers fall back to the peer for rate limits", () => {
  for (const value of ["", "invalid", "198.51.100.1, 198.51.100.2"]) {
    assert.equal(getRequestIp(new Headers({
      "x-vercel-forwarded-for": "172.68.88.196", "cf-connecting-ip": value,
    })), "172.68.88.196");
  }
});

test("preserves normal proxy chains and IPv4-mapped addresses", () => {
  assert.equal(getRequestIp(new Headers({ "x-forwarded-for": "198.51.100.19, 10.0.0.1" })), "198.51.100.19");
  assert.equal(getRequestIp(new Headers({ "x-real-ip": "::ffff:198.51.100.19" })), "198.51.100.19");
});
