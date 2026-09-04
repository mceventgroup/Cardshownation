export const ENRICHABLE_SHOW_FIELDS = [
  "description",
  "venueName",
  "venueAddress",
  "startTimeLabel",
  "endTimeLabel",
  "admissionPrice",
  "admissionNotes",
  "tableCount",
  "websiteUrl",
  "facebookUrl",
  "vendorDetails",
  "parkingInfo",
] as const;

export const ENRICHABLE_SHOW_FIELD_LABELS: Record<string, string> = {
  description: "description",
  venueName: "venue",
  venueAddress: "address",
  startTimeLabel: "start time",
  endTimeLabel: "end time",
  admissionPrice: "admission price",
  admissionNotes: "admission notes",
  tableCount: "table count",
  websiteUrl: "website",
  facebookUrl: "Facebook link",
  vendorDetails: "vendor information",
  parkingInfo: "parking information",
  categories: "categories",
  isFree: "free-admission status",
};

function hasUsefulValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

export function mergeMissingShowDetails(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
) {
  const merged = { ...existing };
  const changedFields: string[] = [];

  for (const field of ENRICHABLE_SHOW_FIELDS) {
    if (!hasUsefulValue(merged[field]) && hasUsefulValue(incoming[field])) {
      merged[field] = incoming[field];
      changedFields.push(field);
    }
  }

  const existingCategories = Array.isArray(existing.categories)
    ? existing.categories.filter((value): value is string => typeof value === "string")
    : [];
  const incomingCategories = Array.isArray(incoming.categories)
    ? incoming.categories.filter((value): value is string => typeof value === "string")
    : [];
  const mergedCategories = [...new Set([...existingCategories, ...incomingCategories])];
  if (mergedCategories.length > existingCategories.length) {
    merged.categories = mergedCategories;
    changedFields.push("categories");
  }

  if (existing.isFree !== true && incoming.isFree === true && !hasUsefulValue(existing.admissionPrice)) {
    merged.isFree = true;
    changedFields.push("isFree");
  }

  return { merged, changedFields };
}
