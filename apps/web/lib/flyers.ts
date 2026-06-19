import { randomUUID } from "crypto";
import { isIP } from "net";
import { isHostedFlyerAssetUrl, persistFlyerAsset } from "@/lib/flyer-storage";
import { normalizeExternalUrl } from "@/lib/url";
import {
  FLYER_MAX_SIZE_BYTES,
  FLYER_REQUIRED_HEIGHT,
  FLYER_REQUIRED_WIDTH,
  isAcceptedFlyerFile,
} from "@/lib/flyer-spec";
import { slugify } from "@/lib/utils";

const FLYER_BACKGROUND = { r: 248, g: 250, b: 252, alpha: 1 };
const FLYER_REMOTE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const DISALLOWED_FLYER_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIpv4Address(hostname: string) {
  const segments = hostname.split(".").map((segment) => Number.parseInt(segment, 10));
  if (segments.length !== 4 || segments.some((segment) => Number.isNaN(segment))) {
    return false;
  }

  const [a, b] = segments;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;

  return false;
}

function isPrivateIpv6Address(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("::ffff:127.")) return true;

  return false;
}

function isDisallowedFlyerSourceHost(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (!normalized) {
    return true;
  }

  if (
    DISALLOWED_FLYER_HOSTNAMES.has(normalized) ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return isPrivateIpv4Address(normalized);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6Address(normalized);
  }

  return false;
}

function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com").replace(/\/$/, "");
}

function buildLocalFlyerUrl(pathname: string) {
  return new URL(pathname, `${getAppBaseUrl()}/`).toString();
}

export function normalizeFlyerUrlForRender(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return buildLocalFlyerUrl(trimmed);
  }

  return normalizeExternalUrl(trimmed);
}

export function isManagedFlyerUrl(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("/uploads/flyers/")) {
    return true;
  }

  const normalized = normalizeExternalUrl(trimmed);
  if (!normalized) {
    return false;
  }

  const url = new URL(normalized);
  const appHost = new URL(getAppBaseUrl()).host;
  return isHostedFlyerAssetUrl(url, appHost);
}

export async function normalizeFlyerImage(bytes: Buffer) {
  const sharp = (await import("sharp")).default;

  try {
    return await sharp(bytes)
      .rotate()
      .resize(FLYER_REQUIRED_WIDTH, FLYER_REQUIRED_HEIGHT, {
        fit: "contain",
        background: FLYER_BACKGROUND,
        position: "centre",
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("Flyers must be valid JPG, PNG, or WebP images.");
  }
}

async function persistNormalizedFlyer(showName: string, normalizedBytes: Buffer) {
  const baseName = slugify(showName) || "show-flyer";
  const finalName = `${baseName}-${randomUUID()}.webp`;
  return persistFlyerAsset(finalName, normalizedBytes);
}

async function readResponseBytes(response: Response, maxBytes: number) {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
      throw new Error(`Flyer source file is too large. Keep it under ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
    }
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error(`Flyer source file is too large. Keep it under ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Flyer source file is too large. Keep it under ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
}

export async function saveRemoteFlyerImage(showName: string, sourceUrl: string) {
  const normalizedSourceUrl = normalizeExternalUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    throw new Error("Flyer URL must be a valid http or https image.");
  }
  const parsedSourceUrl = new URL(normalizedSourceUrl);
  if (isDisallowedFlyerSourceHost(parsedSourceUrl.hostname)) {
    throw new Error("Flyer URL host is not allowed.");
  }

  const response = await fetch(normalizedSourceUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    cache: "no-store",
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error("Could not download the flyer image from that URL.");
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error("Flyer URL must point to an image.");
  }

  const sourceBytes = await readResponseBytes(response, FLYER_REMOTE_MAX_SIZE_BYTES);
  const normalizedBytes = await normalizeFlyerImage(sourceBytes);
  return persistNormalizedFlyer(showName, normalizedBytes);
}

export async function resolveManagedFlyerImageUrl(
  showName: string,
  flyerImageUrl: string | null | undefined
) {
  if (typeof flyerImageUrl !== "string") {
    return null;
  }

  const trimmed = flyerImageUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (isManagedFlyerUrl(trimmed)) {
    return trimmed;
  }

  return saveRemoteFlyerImage(showName, trimmed);
}

export async function saveFlyerImage(showName: string, file: File) {
  if (!file.size) {
    return null;
  }

  if (!isAcceptedFlyerFile(file) || file.size > FLYER_MAX_SIZE_BYTES) {
    throw new Error("Flyers must be JPG, PNG, or WebP images under 2 MB.");
  }

  const normalizedBytes = await normalizeFlyerImage(Buffer.from(await file.arrayBuffer()));
  return persistNormalizedFlyer(showName, normalizedBytes);
}
