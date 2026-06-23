import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { normalizeExternalUrl } from "@/lib/url";

const BLOCKED_HOSTS = new Set(["localhost", "metadata", "metadata.google.internal"]);

function isPrivateIpv4(address: string) {
  const [a, b] = address.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.");
}

export async function assertPublicHttpUrl(value: string) {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) throw new Error("URL must use http or https.");
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("URL host is not allowed.");
  }
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("URL resolves to a private or reserved network.");
  }
  return normalized;
}

export async function fetchPublicUrl(value: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const url = await assertPublicHttpUrl(value);
  return fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
}

export async function readResponseTextLimited(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Remote response is too large.");
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Remote response is too large.");
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}
