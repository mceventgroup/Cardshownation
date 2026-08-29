import { isValidDateInput } from "@/lib/daily-schedule";
import { SHOW_CATEGORIES } from "@/lib/shows";
import { US_STATES } from "@/lib/states";
import { normalizeExternalUrl } from "@/lib/url";

function readRequiredString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : "";
}

function readOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

export function readSubmissionPayloadEdits(formData: FormData) {
  const showName = readRequiredString(formData, "showName", 160);
  const startDate = readRequiredString(formData, "startDate", 10);
  const endDate = readRequiredString(formData, "endDate", 10) || startDate;
  const city = readRequiredString(formData, "city", 80);
  const state = readRequiredString(formData, "state", 2).toUpperCase();
  const venueName = readRequiredString(formData, "venueName", 160);
  const websiteUrlInput = readOptionalString(formData, "websiteUrl", 2048);
  const facebookUrlInput = readOptionalString(formData, "facebookUrl", 2048);
  const websiteUrl = normalizeExternalUrl(websiteUrlInput);
  const facebookUrl = normalizeExternalUrl(facebookUrlInput);

  if (
    !showName ||
    !city ||
    !venueName ||
    !US_STATES.some((option) => option.code === state) ||
    !isValidDateInput(startDate) ||
    !isValidDateInput(endDate) ||
    endDate < startDate ||
    (websiteUrlInput && !websiteUrl) ||
    (facebookUrlInput && !facebookUrl)
  ) {
    return null;
  }

  return {
    showName,
    startDate,
    endDate,
    startTimeLabel: readOptionalString(formData, "startTimeLabel", 32),
    endTimeLabel: readOptionalString(formData, "endTimeLabel", 32),
    city,
    state,
    venueName,
    venueAddress: readOptionalString(formData, "venueAddress", 200),
    categories: formData
      .getAll("categories")
      .filter(
        (value): value is string =>
          typeof value === "string" &&
          SHOW_CATEGORIES.includes(value as (typeof SHOW_CATEGORIES)[number])
      ),
    description: readOptionalString(formData, "description", 4000),
    tableCount: readOptionalString(formData, "tableCount", 6),
    vendorDetails: readOptionalString(formData, "vendorDetails", 200),
    websiteUrl,
    facebookUrl,
    isFree: formData.get("isFree") === "free",
    admissionPrice: readOptionalString(formData, "admissionPrice", 120),
    admissionNotes: readOptionalString(formData, "admissionNotes", 200),
    parkingInfo: readOptionalString(formData, "parkingInfo", 200),
  };
}
