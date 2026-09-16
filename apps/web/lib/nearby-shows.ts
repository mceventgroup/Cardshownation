import { getCityCoords } from "@/lib/city-coords";

export function filterShowsByCityDistance<T extends { city: string; state: string }>(
  shows: T[], lat: number, lng: number, radiusMiles: number,
) {
  return shows.flatMap((show) => {
    const coords = getCityCoords(show.city, show.state);
    if (!coords) return [];
    const radians = Math.PI / 180;
    const a = Math.sin((coords.lat - lat) * radians / 2) ** 2
      + Math.cos(lat * radians) * Math.cos(coords.lat * radians)
      * Math.sin((coords.lng - lng) * radians / 2) ** 2;
    const distance = 3959 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
    return distance <= radiusMiles
      ? [{ ...show, distanceMiles: Math.round(distance * 10) / 10 }]
      : [];
  });
}
