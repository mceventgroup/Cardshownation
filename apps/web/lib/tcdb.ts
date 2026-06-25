import { US_STATES, getStateByCode } from "@/lib/states";
import { fetchPublicUrl, readResponseTextLimited } from "@/lib/safe-remote-fetch";
import type { ImportedShow } from "@/lib/show-import-ingest";

const TCDB_BASE_URL = "https://www.tcdb.com";
const SHOW_MARKER_PREFIX = "[[TCDB_SHOW|";

type ParsedTcdbShow = ImportedShow;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtmlWithShowMarkers(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(
        /<a[^>]+href=["']([^"']*CardShows\.cfm\?MODE=VIEW&ID=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_match, href: string, externalId: string, titleHtml: string) => {
          const title = decodeHtmlEntities(titleHtml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
          return ` ${SHOW_MARKER_PREFIX}${externalId}|${href}|${title}]] `;
        }
      )
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/ul|\/ol)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
  );
}

function parseStateCodes(raw = process.env.TCDB_STATE_CODES) {
  if (!raw) {
    return US_STATES.map((state) => state.code);
  }

  const stateCodes = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const unique = new Set<string>();
  for (const code of stateCodes) {
    if (getStateByCode(code)) {
      unique.add(code);
    }
  }

  return unique.size > 0 ? [...unique] : US_STATES.map((state) => state.code);
}

function buildTcdbListUrl(stateCode: string) {
  const state = getStateByCode(stateCode);
  const displayName = state?.name ?? stateCode;
  const params = new URLSearchParams({
    VIEW: "List",
    State: stateCode,
    Country: "United States",
    Display: displayName,
  });

  return `${TCDB_BASE_URL}/CardShowCalendar.cfm?${params.toString()}`;
}

function parseDateLabel(value: string) {
  const match = value.match(/(?:^|\b)([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}|[A-Za-z]+\s+\d{1,2},\s+\d{4})(?:\b|$)/);
  if (!match) {
    return null;
  }

  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractTimeLabels(value: string) {
  const match = value.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  if (!match) {
    return { startTimeLabel: null, endTimeLabel: null };
  }

  return {
    startTimeLabel: match[1].toUpperCase(),
    endTimeLabel: match[2].toUpperCase(),
  };
}

function extractCityState(value: string, fallbackState: string) {
  const parenMatch = value.match(/\(([^,()]+),\s*([A-Z]{2})\)/);
  if (parenMatch) {
    return {
      city: parenMatch[1].trim(),
      state: parenMatch[2].trim(),
    };
  }

  const plainMatch = value.match(/\b([^,()]+),\s*([A-Z]{2})\b/);
  if (plainMatch) {
    return {
      city: plainMatch[1].trim(),
      state: plainMatch[2].trim(),
    };
  }

  return {
    city: null,
    state: fallbackState,
  };
}

function inferCategories(title: string) {
  const text = title.toLowerCase();
  const categories: string[] = [];
  if (/pokemon|pok[eé]mon|tcg|trading card/.test(text)) categories.push("Pokemon");
  if (/magic|mtg|gathering/.test(text)) categories.push("Magic: The Gathering");
  if (/yugioh|yu-gi-oh/.test(text)) categories.push("Yu-Gi-Oh");
  if (/sport|baseball|football|basketball|hockey|soccer/.test(text) || categories.length === 0) {
    categories.push("Sports Cards");
  }
  return [...new Set(categories)];
}

function normalizeDescription(lines: string[]) {
  if (lines.length === 0) {
    return null;
  }

  return lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 1000) || null;
}

export function parseTcdbCalendarHtml(html: string, fallbackState: string): ParsedTcdbShow[] {
  const text = stripHtmlWithShowMarkers(html);
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const shows: ParsedTcdbShow[] = [];
  let currentDate: Date | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const parsedDate = parseDateLabel(line);
    if (parsedDate) {
      currentDate = parsedDate;
    }

    if (!line.includes(SHOW_MARKER_PREFIX)) {
      continue;
    }

    const markerMatch = line.match(/\[\[TCDB_SHOW\|(\d+)\|([^|]+)\|(.+?)\]\]/);
    if (!markerMatch) {
      continue;
    }

    const [, externalId, href, title] = markerMatch;
    const contextLines = [
      line.replace(markerMatch[0], title).trim(),
      lines[index + 1] ?? "",
      lines[index + 2] ?? "",
    ].filter(Boolean);

    const contextText = contextLines.join(" ");
    const { city, state } = extractCityState(contextText, fallbackState);
    if (!currentDate || !city || !state) {
      continue;
    }

    const { startTimeLabel, endTimeLabel } = extractTimeLabels(contextText);
    const sourceUrl = href.startsWith("http") ? href : `${TCDB_BASE_URL}/${href.replace(/^\/+/, "")}`;
    const descriptionParts = [...contextLines];
    if (startTimeLabel && endTimeLabel) {
      descriptionParts.push(`Hours: ${startTimeLabel} - ${endTimeLabel}`);
    }

    shows.push({
      externalId: `tcdb:${externalId}`,
      title,
      description: normalizeDescription(descriptionParts),
      startDate: currentDate,
      endDate: currentDate,
      city,
      state,
      venueName: null,
      venueAddress: null,
      venueLat: null,
      venueLng: null,
      isFree: false,
      admissionPrice: null,
      admissionNotes: null,
      websiteUrl: sourceUrl,
      facebookUrl: null,
      categories: inferCategories(title),
      organizerName: null,
      sourceUrl,
    });
  }

  const unique = new Map<string, ParsedTcdbShow>();
  for (const show of shows) {
    unique.set(show.externalId, show);
  }

  return [...unique.values()];
}

export async function fetchTcdbShowsByState(stateCode: string) {
  const response = await fetchPublicUrl(
    buildTcdbListUrl(stateCode),
    {
      headers: {
        "user-agent": "Card Show Nation Import Bot/1.0 (+https://cardshownation.com)",
        accept: "text/html,application/xhtml+xml",
      },
    },
    15_000
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await readResponseTextLimited(response, 2 * 1024 * 1024);
  return parseTcdbCalendarHtml(html, stateCode);
}

export async function fetchCardShowsFromTcdb() {
  const supportedStateCodes = parseStateCodes();
  const results: ParsedTcdbShow[] = [];

  for (const stateCode of supportedStateCodes) {
    const shows = await fetchTcdbShowsByState(stateCode);
    results.push(...shows);
  }

  return results;
}

export function getTcdbImportStateCodes() {
  return parseStateCodes();
}

export function getTcdbImportStateLabels() {
  return parseStateCodes().map((code) => US_STATES.find((state) => state.code === code)?.name ?? code);
}
