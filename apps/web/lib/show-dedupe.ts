const GENERIC_TITLE_WORDS = new Set([
  "a", "an", "the", "and", "show", "card", "cards", "sport", "sports",
  "sportscard", "sportscards", "collectible", "collectibles", "memorabilia",
  "expo", "event",
]);

function words(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/pokemon/g, "pokemon")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.endsWith("s") && word.length > 4 ? word.slice(0, -1) : word);
}

function meaningfulWords(value: unknown) {
  const filtered = words(value).filter((word) => !GENERIC_TITLE_WORDS.has(word));
  return filtered.length > 0 ? filtered : words(value);
}

function similarity(left: unknown, right: unknown) {
  const a = new Set(meaningfulWords(left));
  const b = new Set(meaningfulWords(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / Math.max(a.size, b.size);
}

function normalized(value: unknown) {
  return words(value).join("");
}

export type DedupeRecord = {
  showName?: unknown;
  startDate?: unknown;
  city?: unknown;
  state?: unknown;
  venueName?: unknown;
  venueAddress?: unknown;
  description?: unknown;
  websiteUrl?: unknown;
  facebookUrl?: unknown;
  tableCount?: unknown;
  startTimeLabel?: unknown;
  endTimeLabel?: unknown;
  admissionPrice?: unknown;
  admissionNotes?: unknown;
  vendorDetails?: unknown;
  parkingInfo?: unknown;
  categories?: unknown;
  isFree?: unknown;
};

export function showMatchScore(left: DedupeRecord, right: DedupeRecord) {
  if (String(left.startDate ?? "") !== String(right.startDate ?? "")) return 0;
  if (normalized(left.city) !== normalized(right.city)) return 0;
  if (String(left.state ?? "").toUpperCase() !== String(right.state ?? "").toUpperCase()) return 0;

  const titleScore = similarity(left.showName, right.showName);
  const exactTitle = normalized(left.showName) === normalized(right.showName);
  const hasDistinctiveTitle = words(left.showName).some((word) => !GENERIC_TITLE_WORDS.has(word));
  const leftVenue = normalized(left.venueName);
  const rightVenue = normalized(right.venueName);
  const addressMatch = Boolean(normalized(left.venueAddress)) && normalized(left.venueAddress) === normalized(right.venueAddress);
  const venueConflict = leftVenue && rightVenue && similarity(left.venueName, right.venueName) < 0.65;
  if (venueConflict && !addressMatch && (!exactTitle || !hasDistinctiveTitle)) return 0;

  const venueScore = leftVenue && rightVenue ? similarity(left.venueName, right.venueName) : 0;
  let score = exactTitle ? 100 : Math.round(titleScore * 86);
  if (addressMatch) score = Math.max(score + 10, 92);
  else if (venueScore >= 0.85) score = Math.max(score + 7, 82);
  else if (venueScore >= 0.65) score += 7;
  return Math.min(score, 100);
}

export function isLikelyDuplicate(left: DedupeRecord, right: DedupeRecord) {
  return showMatchScore(left, right) >= 72;
}

export function informationScore(record: DedupeRecord) {
  const fields = ["venueName", "venueAddress", "description", "websiteUrl", "facebookUrl", "tableCount", "startTimeLabel", "endTimeLabel"] as const;
  return fields.reduce((score, field) => {
    const value = record[field];
    return score + (typeof value === "string" ? (value.trim() ? 1 : 0) : value ? 1 : 0);
  }, 0);
}
