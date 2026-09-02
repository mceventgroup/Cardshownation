type HeaderSource = Pick<Headers, "get">;

export type ApproximateRequestLocation = {
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
};

function readCoordinate(value: string | null, min: number, max: number) {
  if (value === null) return null;

  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
}

function readCity(value: string | null) {
  if (!value) return null;

  try {
    return decodeURIComponent(value).slice(0, 120);
  } catch {
    return value.slice(0, 120);
  }
}

export function getApproximateRequestLocation(
  headers: HeaderSource
): ApproximateRequestLocation | null {
  const lat = readCoordinate(headers.get("x-vercel-ip-latitude"), -90, 90);
  const lng = readCoordinate(headers.get("x-vercel-ip-longitude"), -180, 180);

  if (lat === null || lng === null) {
    return null;
  }

  return {
    lat,
    lng,
    city: readCity(headers.get("x-vercel-ip-city")),
    region: headers.get("x-vercel-ip-country-region")?.slice(0, 12) ?? null,
  };
}

export function formatApproximateLocation(
  location: Pick<ApproximateRequestLocation, "city" | "region">
) {
  return [location.city, location.region].filter(Boolean).join(", ") || null;
}
