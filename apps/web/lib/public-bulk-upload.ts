import { isValidDateInput } from "@/lib/daily-schedule";
import { US_STATES } from "@/lib/states";
import { normalizeExternalUrl } from "@/lib/url";

export const PUBLIC_BULK_UPLOAD_HEADERS = [
  "title",
  "startDate",
  "endDate",
  "startTimeLabel",
  "endTimeLabel",
  "city",
  "state",
  "venueName",
  "venueAddress",
  "categories",
  "description",
  "tableCount",
  "vendorDetails",
  "websiteUrl",
  "facebookUrl",
  "isFree",
  "admissionPrice",
  "admissionNotes",
  "parkingInfo",
] as const;

export const MAX_PUBLIC_BULK_UPLOAD_BYTES = 750 * 1024;
export const MAX_PUBLIC_BULK_UPLOAD_ROWS = 100;

const REQUIRED_HEADERS = ["title", "startDate", "city", "state", "venueName"] as const;
const ALLOWED_CATEGORIES = [
  "Sports Cards",
  "Pokemon",
  "TCG",
  "Mixed",
  "Memorabilia",
  "Comics",
  "Trade Night",
  "Autograph Guests",
] as const;
const CATEGORY_ALIASES = new Map(ALLOWED_CATEGORIES.map((category) => [category.toLowerCase(), category]));
CATEGORY_ALIASES.set("sports", "Sports Cards");
CATEGORY_ALIASES.set("sports cards", "Sports Cards");
CATEGORY_ALIASES.set("pokémon", "Pokemon");

export type PublicBulkCsvRow = Partial<Record<(typeof PUBLIC_BULK_UPLOAD_HEADERS)[number], string>> & {
  rowNumber: number;
};

export type ValidPublicBulkRow = {
  rowNumber: number;
  payload: Record<string, unknown>;
};

export type BulkRowError = { row: number; message: string };

const HEADER_ALIASES: Record<string, (typeof PUBLIC_BULK_UPLOAD_HEADERS)[number]> = {
  showname: "title",
  name: "title",
  date: "startDate",
  starttime: "startTimeLabel",
  endtime: "endTimeLabel",
  address: "venueAddress",
  streetaddress: "venueAddress",
  venue: "venueName",
  website: "websiteUrl",
  facebook: "facebookUrl",
  free: "isFree",
  freeadmission: "isFree",
};

export function normalizeBulkHeader(header: string) {
  const compact = header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const exact = PUBLIC_BULK_UPLOAD_HEADERS.find((candidate) => candidate.toLowerCase() === compact);
  return exact ?? HEADER_ALIASES[compact] ?? header.trim();
}

function clean(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function duplicateKey(payload: Record<string, unknown>) {
  return [payload.showName, payload.startDate, payload.city, payload.state]
    .map((value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, ""))
    .join("|");
}

export function getMissingBulkHeaders(headers: string[]) {
  const normalized = new Set(headers.map((header) => normalizeBulkHeader(header)));
  return REQUIRED_HEADERS.filter((header) => !normalized.has(header));
}

export function validatePublicBulkRows(rows: PublicBulkCsvRow[]) {
  const validRows: ValidPublicBulkRow[] = [];
  const errors: BulkRowError[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const showName = clean(row.title, 160);
    const startDate = clean(row.startDate, 10);
    const endDate = clean(row.endDate, 10) ?? startDate;
    const city = clean(row.city, 80);
    const state = clean(row.state, 2)?.toUpperCase() ?? null;
    const venueName = clean(row.venueName, 160);

    if (!showName || !startDate || !endDate || !city || !state || !venueName) {
      errors.push({ row: row.rowNumber, message: "Add a title, start date, city, 2-letter state, and venue name." });
      continue;
    }
    if (!isValidDateInput(startDate) || !isValidDateInput(endDate) || endDate < startDate) {
      errors.push({ row: row.rowNumber, message: "Dates must use YYYY-MM-DD, and the end date cannot be before the start date." });
      continue;
    }
    if (!US_STATES.some((option) => option.code === state)) {
      errors.push({ row: row.rowNumber, message: "State must be a valid 2-letter U.S. state code." });
      continue;
    }

    const rawCategories = clean(row.categories, 300);
    const requestedCategories = rawCategories
      ? rawCategories.split(/[,;|]/).map((value) => value.trim()).filter(Boolean)
      : [];
    const categories = requestedCategories.flatMap((value) => {
      const category = CATEGORY_ALIASES.get(value.toLowerCase());
      return category ? [category] : [];
    });
    const invalidCategories = requestedCategories.filter((value) => !CATEGORY_ALIASES.has(value.toLowerCase()));
    if (invalidCategories.length > 0) {
      errors.push({ row: row.rowNumber, message: `Unknown categories: ${invalidCategories.join(", ")}.` });
      continue;
    }

    const tableCountText = clean(row.tableCount, 6);
    const tableCount = tableCountText ? Number.parseInt(tableCountText, 10) : null;
    if (tableCountText && (!/^\d+$/.test(tableCountText) || !tableCount || tableCount > 999999)) {
      errors.push({ row: row.rowNumber, message: "Table count must be a positive whole number." });
      continue;
    }

    const websiteInput = clean(row.websiteUrl, 2048);
    const facebookInput = clean(row.facebookUrl, 2048);
    const websiteUrl = normalizeExternalUrl(websiteInput);
    const facebookUrl = normalizeExternalUrl(facebookInput);
    if (websiteInput && !websiteUrl) {
      errors.push({ row: row.rowNumber, message: "Website must be a valid http or https link." });
      continue;
    }
    if (facebookInput && !facebookUrl) {
      errors.push({ row: row.rowNumber, message: "Facebook must be a valid http or https link." });
      continue;
    }

    const freeValue = clean(row.isFree, 12)?.toLowerCase() ?? "";
    const freeValues = ["yes", "true", "1", "free"];
    const paidValues = ["", "no", "false", "0", "paid"];
    if (!freeValues.includes(freeValue) && !paidValues.includes(freeValue)) {
      errors.push({ row: row.rowNumber, message: 'Free admission must be "yes" or "no".' });
      continue;
    }

    const payload = {
      showName,
      startDate,
      endDate,
      sameTimesEachDay: true,
      dailySchedule: null,
      startTimeLabel: clean(row.startTimeLabel, 32),
      endTimeLabel: clean(row.endTimeLabel, 32),
      city,
      state,
      venueName,
      venueAddress: clean(row.venueAddress, 200),
      categories: [...new Set(categories)],
      description: clean(row.description, 4000),
      tableCount: tableCount ? String(tableCount) : null,
      vendorDetails: clean(row.vendorDetails, 200),
      websiteUrl,
      facebookUrl,
      isFree: freeValues.includes(freeValue),
      admissionPrice: clean(row.admissionPrice, 120),
      admissionNotes: clean(row.admissionNotes, 200),
      parkingInfo: clean(row.parkingInfo, 200),
      flyerImageUrl: null,
      submittedViaBulkUpload: true,
    } satisfies Record<string, unknown>;

    const key = duplicateKey(payload);
    if (seen.has(key)) {
      errors.push({ row: row.rowNumber, message: "This is a duplicate of another row in the same upload." });
      continue;
    }
    seen.add(key);
    validRows.push({ rowNumber: row.rowNumber, payload });
  }

  return { validRows, errors };
}
