import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getRequestIp, isLocalIp } from "@/lib/request-ip";
import { getStateByCode, US_STATES } from "@/lib/states";

export const IP_STATE_TIMEOUT_MS = 1200;
const CACHE_AGE_MS = 15 * 60 * 1000;
const CACHE_LIMIT = 1000;

// undefined means the provider failed; null means it answered without a US state.
type StateResult = string | null | undefined;

function isPublicIp(ip: string) {
  const version = isIP(ip);
  if (!version || isLocalIp(ip)) return false;
  if (version === 4) {
    const [first, second] = ip.split(".").map(Number);
    return first !== 0 && first !== 127 && first < 224
      && !(first === 169 && second === 254)
      && !(first === 100 && second >= 64 && second <= 127);
  }
  return ip !== "::" && !ip.toLowerCase().startsWith("ff")
    && !ip.toLowerCase().startsWith("::ffff:");
}

export function createIpStateLookup(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expiresAt: number; result: Promise<StateResult> }>();

  async function request(ip: string): Promise<StateResult> {
    try {
      const response = await fetcher(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`, {
        cache: "no-store",
        signal: AbortSignal.timeout(IP_STATE_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return undefined;
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
      const record = data as Record<string, unknown>;
      if (record.ip !== ip || typeof record.country_code !== "string") return undefined;
      if (record.country_code !== "US") return null;
      if (typeof record.region !== "string") return undefined;
      const region = record.region.trim();
      return getStateByCode(region)?.code
        ?? US_STATES.find((state) => state.name.toLowerCase() === region.toLowerCase())?.code
        ?? undefined;
    } catch {
      // Never log the URL or error: it can contain the visitor's IP address.
      return undefined;
    }
  }

  return async (ip: string): Promise<StateResult> => {
    if (!isPublicIp(ip)) return undefined;
    const key = createHash("sha256").update(ip).digest("hex");
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return cached.result;
    for (const [entryKey, entry] of cache) {
      if (entry.expiresAt <= now()) cache.delete(entryKey);
    }
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    const entry = { expiresAt: now() + CACHE_AGE_MS, result: request(ip) };
    cache.set(key, entry);
    const result = await entry.result;
    if (result === undefined) entry.expiresAt = now() + 30_000;
    return result;
  };
}

const lookupIpState = createIpStateLookup();

export async function getRequestState(
  headers: Pick<Headers, "get">,
  lookup = lookupIpState,
) {
  const ip = getRequestIp(headers);
  if (ip && isPublicIp(ip)) {
    const state = await lookup(ip);
    if (state !== undefined) return getStateByCode(state);
  }
  return headers.get("x-vercel-ip-country") === "US"
    ? getStateByCode(headers.get("x-vercel-ip-country-region"))
    : null;
}
