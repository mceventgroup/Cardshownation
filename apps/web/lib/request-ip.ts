import { isIP } from "node:net";
import { isCloudflareIp } from "@/lib/cloudflare-ip";

type HeaderSource = Pick<Headers, "get">;

function normalizeIpCandidate(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null;
  }

  const firstValue = rawValue.split(",")[0]?.trim();
  if (!firstValue) {
    return null;
  }

  const normalized = firstValue.toLowerCase().startsWith("::ffff:")
    ? firstValue.slice("::ffff:".length)
    : firstValue;

  if (isIP(normalized)) {
    return normalized;
  }

  return null;
}

export function getRequestPeerIp(headers: HeaderSource) {
  return (
    normalizeIpCandidate(headers.get("x-vercel-forwarded-for")) ??
    normalizeIpCandidate(headers.get("x-real-ip")) ??
    normalizeIpCandidate(headers.get("x-forwarded-for"))
  );
}

export function getRequestIp(headers: HeaderSource) {
  const peer = getRequestPeerIp(headers);
  // Vercel sees Cloudflare's proxy address. Only a verified proxy may supply
  // CF-Connecting-IP; a direct visitor cannot spoof this header to evade limits.
  if (isCloudflareIp(peer)) {
    const forwarded = headers.get("cf-connecting-ip");
    const client = forwarded?.includes(",") ? null : normalizeIpCandidate(forwarded);
    if (client) return client;
  }
  return peer;
}

export function isLocalIp(ip: string | null) {
  if (!ip) {
    return true;
  }

  const normalized = ip.toLowerCase();
  if (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }

  if (!normalized.startsWith("172.")) {
    return false;
  }

  const secondOctet = Number.parseInt(normalized.split(".")[1] ?? "", 10);
  return Number.isInteger(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
}
