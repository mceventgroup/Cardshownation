export const NEARBY_LOCATION_STORAGE_KEY = "csn_nearby_location";
export const NEARBY_LOCATION_MAX_AGE_MS = 15 * 60 * 1000;

export type StoredNearbyLocation = {
  lat: number;
  lng: number;
  createdAt: number;
};

export function parseStoredNearbyLocation(
  value: string | null,
  now = Date.now(),
): StoredNearbyLocation | null {
  if (!value) return null;

  try {
    const candidate = JSON.parse(value) as Partial<StoredNearbyLocation>;
    if (
      typeof candidate.lat !== "number" ||
      !Number.isFinite(candidate.lat) ||
      candidate.lat < -90 ||
      candidate.lat > 90 ||
      typeof candidate.lng !== "number" ||
      !Number.isFinite(candidate.lng) ||
      candidate.lng < -180 ||
      candidate.lng > 180 ||
      typeof candidate.createdAt !== "number" ||
      !Number.isFinite(candidate.createdAt) ||
      candidate.createdAt > now + 60_000 ||
      now - candidate.createdAt > NEARBY_LOCATION_MAX_AGE_MS
    ) {
      return null;
    }

    return {
      lat: candidate.lat,
      lng: candidate.lng,
      createdAt: candidate.createdAt,
    };
  } catch {
    return null;
  }
}
