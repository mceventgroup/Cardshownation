type HeaderSource = Pick<Headers, "get">;

function normalizeIpCandidate(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null;
  }

  const firstValue = rawValue.split(",")[0]?.trim();
  if (!firstValue) {
    return null;
  }

  const normalized = firstValue.startsWith("::ffff:")
    ? firstValue.slice("::ffff:".length)
    : firstValue;

  if (isValidIpv4(normalized) || isValidIpv6(normalized)) {
    return normalized;
  }

  return null;
}

function isValidIpv4(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }

    const number = Number.parseInt(part, 10);
    return number >= 0 && number <= 255;
  });
}

function isValidIpv6(value: string) {
  return value.includes(":") && /^[0-9a-f:]+$/i.test(value);
}

export function getRequestIp(headers: HeaderSource) {
  return (
    normalizeIpCandidate(headers.get("x-vercel-forwarded-for")) ??
    normalizeIpCandidate(headers.get("x-real-ip")) ??
    normalizeIpCandidate(headers.get("x-forwarded-for"))
  );
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
