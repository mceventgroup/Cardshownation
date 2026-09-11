import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { ImportedShow } from "@/lib/show-import-ingest";
import { US_STATES } from "@/lib/states";
import { fetchPublicUrl, readResponseTextLimited } from "@/lib/safe-remote-fetch";

export const KANSAS_SHEET_SOURCE = "kansas-card-show-database";
export const KANSAS_SHEET_LABEL = "Kansas Card Show Database";
export const KANSAS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1_hjAwVfAQE03i9tH9be9DHlmQbjEnEl-XEL0YG91UJc/edit#gid=1567922315";
// gviz returns CSV directly, without the redirects used by /export. Pin the
// Published tab by ID so tab ordering and names cannot switch the source.
export const KANSAS_SHEET_FEED_URL = "https://docs.google.com/spreadsheets/d/1_hjAwVfAQE03i9tH9be9DHlmQbjEnEl-XEL0YG91UJc/gviz/tq?tqx=out:csv&gid=1567922315&headers=1";

function normalized(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseSheetDate(value: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]) + (match[3].length === 2 ? 2000 : 0);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date : null;
}

export function parseKansasCardShowSheet(csv: string) {
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), { delimiter: ",", skipEmptyLines: false });
  if (parsed.errors.length > 0) {
    throw new Error(`Unable to read Published CSV: ${parsed.errors[0].message}`);
  }
  const headers = (parsed.data[0] ?? []).map(normalized);
  const required = ["card show name", "start date", "end date", "city", "state"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Published sheet is missing required columns: ${missing.join(", ")}.`);
  if (required.some((header) => headers.indexOf(header) !== headers.lastIndexOf(header))) {
    throw new Error("Published sheet has duplicate required columns.");
  }

  const shows: ImportedShow[] = [];
  const errors: string[] = [];
  let rowsRead = 0;
  parsed.data.slice(1).forEach((row, index) => {
    if (row.every((value) => !value.trim())) return;
    rowsRead++;
    const cell = (header: string) => (row[headers.indexOf(header)] ?? "").trim();
    const title = cell("card show name");
    const city = cell("city");
    const stateText = normalized(cell("state"));
    const state = US_STATES.find((item) => item.code.toLowerCase() === stateText || item.name.toLowerCase() === stateText)?.code;
    const startDate = parseSheetDate(cell("start date"));
    const endText = cell("end date");
    const endDate = endText ? parseSheetDate(endText) : startDate;
    const rowLabel = `Published row ${index + 2}${title ? ` (${title})` : ""}`;
    if (!title || !city || !state || !startDate || !endDate) {
      errors.push(`${rowLabel}: missing name/city, unknown US state, or invalid date (expected M/D/YYYY or M/D/YY).`);
      return;
    }
    if (endDate < startDate) {
      errors.push(`${rowLabel}: end date precedes start date.`);
      return;
    }
    const tableText = cell("number of tables/ use a number only");
    const tableCount = /^\d+$/.test(tableText) && Number.isSafeInteger(Number(tableText)) && Number(tableText) > 0
      ? Number(tableText) : null;
    if (tableText && tableCount === null) errors.push(`${rowLabel}: invalid table count; imported without a table count.`);

    // No row numbers, end dates, or table counts in identity: sorting the sheet
    // and adding details must not create new submissions on the next run.
    const identity = [normalized(title), startDate.toISOString().slice(0, 10), normalized(city), state];
    const externalId = `${KANSAS_SHEET_SOURCE}:${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
    const categories: string[] = [];
    if (/\b(pok[eé]mon|poke[kc]on)\b/i.test(title)) categories.push("Pokemon");
    if (/\btcg\b/i.test(title)) categories.push("TCG");
    if (/\bsports?\b/i.test(title)) categories.push("Sports Cards");

    shows.push({
      externalId, title, startDate, endDate, city, state,
      venueName: cell("venue name / location name") || null,
      tableCount,
      categories,
      description: null,
      venueAddress: null,
      venueLat: null,
      venueLng: null,
      isFree: false,
      admissionPrice: null,
      websiteUrl: null,
      organizerName: null,
      sourceUrl: KANSAS_SHEET_URL,
    });
  });
  return { shows, errors, rowsRead };
}

export async function fetchKansasCardShowSheet() {
  const response = await fetchPublicUrl(KANSAS_SHEET_FEED_URL, {
    headers: { accept: "text/csv", "user-agent": "Card Show Nation Import Bot/1.0 (+https://cardshownation.com)" },
  }, 20_000);
  if (!response.ok) throw new Error(`Published sheet returned HTTP ${response.status}. Check that it is still publicly readable.`);
  const csv = await readResponseTextLimited(response, 2 * 1024 * 1024);
  return parseKansasCardShowSheet(csv);
}
