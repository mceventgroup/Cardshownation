import type { PublicImportSource } from "@/lib/auto-import-sources";
import type { ImportedShow } from "@/lib/show-import-ingest";
import { getStateByCode, US_STATES } from "@/lib/states";
import { normalizeExternalUrl } from "@/lib/url";

const MONTH_PATTERN = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripMarkup(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMonth(value: string) {
  return MONTHS[value.toLowerCase().replace(".", "")];
}

export function parseShowDateRange(value: string, fallbackYear = new Date().getUTCFullYear()) {
  const yearMatch = value.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : fallbackYear;
  const withoutYear = value.replace(/\b20\d{2}\b/, "");
  const first = new RegExp(`(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})`, "i").exec(withoutYear);
  if (!first) return null;

  const startMonth = normalizeMonth(first[1]);
  const startDay = Number(first[2]);
  if (startMonth === undefined || startDay < 1 || startDay > 31) return null;

  const tail = withoutYear.slice((first.index ?? 0) + first[0].length);
  const secondMonth = new RegExp(`(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})`, "i").exec(tail);
  let endMonth = startMonth;
  let endDay = startDay;
  if (secondMonth) {
    endMonth = normalizeMonth(secondMonth[1]);
    endDay = Number(secondMonth[2]);
  } else {
    const extraDays = [...tail.matchAll(/(?:&|,|-)\s*(\d{1,2})(?!\d)/g)].map((match) => Number(match[1]));
    if (extraDays.length > 0) endDay = extraDays.at(-1) ?? startDay;
  }

  const endYear = endMonth < startMonth ? year + 1 : year;
  const startDate = new Date(Date.UTC(year, startMonth, startDay));
  const endDate = new Date(Date.UTC(endYear, endMonth, endDay));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return { startDate, endDate };
}

function addressParts(value: string, fallbackCity?: string, fallbackState?: string) {
  const compact = value.replace(/\\,/g, ",").replace(/\s+/g, " ").trim();
  const matches = [...compact.matchAll(/,\s*([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?/g)];
  const match = matches.at(-1);
  const city = match?.[1]?.trim() ?? fallbackCity ?? null;
  const state = match?.[2]?.toUpperCase() ?? fallbackState?.toUpperCase() ?? null;
  if (!city || !state || !getStateByCode(state)) return null;

  const beforeCity = match ? compact.slice(0, match.index) : compact;
  const colonParts = beforeCity.split(/:\s*/);
  const commaParts = beforeCity.split(/,\s*/).filter(Boolean);
  let venueName: string | null = null;
  let venueAddress: string | null = null;

  if (colonParts.length > 1) {
    venueName = colonParts[0].trim();
    venueAddress = colonParts.slice(1).join(": ").trim();
  } else if (commaParts.length >= 2) {
    venueName = commaParts.slice(0, -1).join(", ").trim();
    venueAddress = commaParts.at(-1)?.trim() ?? null;
  }

  return { city, state, venueName, venueAddress };
}

function externalId(prefix: string, title: string, startDate: Date, city: string, state: string) {
  return [prefix, startDate.toISOString().slice(0, 10), state, city, title]
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, "-");
}

function parseTimeRange(value: string) {
  const match = value.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*(?:-|to|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i);
  return match ? { startTimeLabel: match[1].toUpperCase(), endTimeLabel: match[2].toUpperCase() } : {};
}

function categories(source: PublicImportSource) {
  return source.categories?.length ? source.categories : ["Sports Cards", "Pokemon", "TCG"];
}

export function parsePremierShows(html: string, source: PublicImportSource): ImportedShow[] {
  const publicHtml = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const markerPattern = />\s*NEXT SHOW\s*</gi;
  const markerIndexes = [...publicHtml.matchAll(markerPattern)].map((match) => match.index ?? 0);
  const shows: ImportedShow[] = [];

  markerIndexes.forEach((markerIndex, position) => {
    const segment = publicHtml.slice(markerIndex, markerIndexes[position + 1] ?? publicHtml.length);
    const textNodes = [...segment.matchAll(/<(h[1-6]|p)[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((match) => stripMarkup(match[2]))
      .filter(Boolean);
    const venueName = textNodes.find((text) => !/^(next show|upcoming show info)$/i.test(text)) ?? null;
    const venueAddress = textNodes.find((text) => /,\s*[A-Z]{2}\s+\d{5}\b/.test(text)) ?? null;
    const dateText = textNodes.find((text) => new RegExp(MONTH_PATTERN, "i").test(text) && /\b20\d{2}\b/.test(text));
    const location = venueAddress ? addressParts(venueAddress) : null;
    const dates = dateText ? parseShowDateRange(dateText) : null;
    if (!venueName || !venueAddress || !location || !dates) return;

    const timeText = textNodes.find((text) => /\b(?:AM|PM)\b/i.test(text) && /(?:-|to|–|—)/.test(text));
    const tableText = textNodes.find((text) => /\btable/i.test(text));
    const admissionText = textNodes.find((text) => /free event|admission|^\$\d/i.test(text));
    const price = admissionText?.match(/\$\d[^,;]*/)?.[0] ?? null;
    const isFree = !price && Boolean(admissionText && /free/i.test(admissionText));
    const title = `Premier Card Show - ${location.city}`;

    shows.push({
      externalId: externalId("premier", title, dates.startDate, location.city, location.state),
      title,
      description: textNodes.slice(0, 12).join(" · "),
      startDate: dates.startDate,
      endDate: dates.endDate,
      city: location.city,
      state: location.state,
      venueName,
      venueAddress: location.venueAddress ?? venueAddress,
      venueLat: null,
      venueLng: null,
      isFree,
      admissionPrice: price,
      admissionNotes: admissionText ?? null,
      tableCount: tableText ? Number.parseInt(tableText, 10) || null : null,
      ...parseTimeRange(timeText ?? ""),
      websiteUrl: source.url,
      categories: categories(source),
      organizerName: source.organizerName ?? "Premier Card Shows",
      sourceUrl: source.url,
    });
  });

  return [...new Map(shows.map((show) => [show.externalId, show])).values()];
}

export function parseGasShows(html: string, source: PublicImportSource): ImportedShow[] {
  const items = html.matchAll(/<li[^>]*class=["'][^"']*accordion-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi);
  const shows: ImportedShow[] = [];

  for (const item of items) {
    const block = item[1];
    const titleMatch = block.match(/accordion-item__title["'][^>]*>([\s\S]*?)<\/span>/i);
    const heading = titleMatch ? stripMarkup(titleMatch[1]) : "";
    const headingParts = heading.split(/\s+-\s+/);
    if (headingParts.length < 2) continue;
    const market = headingParts.shift() ?? "";
    const dateText = headingParts.join(" - ");
    const marketMatch = market.match(/^(.+),\s*([A-Z]{2})$/);
    const dates = parseShowDateRange(dateText);
    if (!marketMatch || !dates || !getStateByCode(marketMatch[2])) continue;

    const city = marketMatch[1].trim();
    const state = marketMatch[2];
    const lines = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => stripMarkup(match[1])).filter(Boolean);
    const addressIndex = lines.findIndex((line) => /,\s*[A-Z]{2}\s+\d{5}\b/.test(line));
    const venueAddressLine = addressIndex >= 0 ? lines[addressIndex] : null;
    const venueName = addressIndex > 0 ? lines[addressIndex - 1] : null;
    const parsedAddress = venueAddressLine ? addressParts(`${venueName ?? ""}, ${venueAddressLine}`, city, state) : null;
    const tableText = lines.find((line) => /\btables?\b/i.test(line));
    const admissionLines = lines.filter((line) => /admission|kids?.*free|under.*free/i.test(line));
    const pricedAdmission = admissionLines.find((line) => /\$\d/.test(line));
    const timeText = lines.find((line) => /\b(?:AM|PM)\b/i.test(line) && /(?:-|to|–|—)/.test(line));
    const title = `G.A.S. Card Show - ${city}`;

    shows.push({
      externalId: externalId("gas", title, dates.startDate, city, state),
      title,
      description: lines.join(" · ").slice(0, 1000) || null,
      startDate: dates.startDate,
      endDate: dates.endDate,
      city,
      state,
      venueName: venueName ?? parsedAddress?.venueName ?? null,
      venueAddress: parsedAddress?.venueAddress ?? venueAddressLine,
      venueLat: null,
      venueLng: null,
      isFree: !pricedAdmission && admissionLines.some((line) => /free/i.test(line)),
      admissionPrice: pricedAdmission?.match(/\$\d[^;]*/)?.[0] ?? null,
      admissionNotes: admissionLines.join(" · ") || null,
      tableCount: tableText ? Number.parseInt(tableText, 10) || null : null,
      ...parseTimeRange(timeText ?? ""),
      websiteUrl: source.url,
      categories: categories(source),
      organizerName: source.organizerName ?? "G.A.S. Card Shows",
      sourceUrl: source.url,
    });
  }

  return shows;
}

function unfoldIcs(value: string) {
  return value.replace(/\r?\n[ \t]/g, "");
}

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseIcsDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

export function parseComcCalendar(ics: string, source: PublicImportSource): ImportedShow[] {
  const events = unfoldIcs(ics).matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g);
  const shows: ImportedShow[] = [];

  for (const event of events) {
    const fields = new Map<string, string>();
    for (const line of event[1].split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      fields.set(line.slice(0, separator).split(";")[0].toUpperCase(), unescapeIcs(line.slice(separator + 1)));
    }
    if (!/\bcard shows?\b/i.test(fields.get("CATEGORIES") ?? "")) continue;
    const startDate = parseIcsDate(fields.get("DTSTART") ?? "");
    const locationText = fields.get("LOCATION") ?? "";
    const location = addressParts(locationText);
    if (!startDate || !location) continue;
    const rawEnd = parseIcsDate(fields.get("DTEND") ?? "");
    const endDate = rawEnd && rawEnd > startDate ? new Date(rawEnd.getTime() - 86_400_000) : startDate;
    const title = (fields.get("SUMMARY") ?? "COMC Card Show").replace(/^COMC:\s*/i, "").trim();
    const uid = fields.get("UID") ?? externalId("comc", title, startDate, location.city, location.state);

    shows.push({
      externalId: `comc:${uid}`,
      title,
      description: fields.get("DESCRIPTION") ?? null,
      startDate,
      endDate,
      city: location.city,
      state: location.state,
      venueName: location.venueName,
      venueAddress: location.venueAddress,
      venueLat: null,
      venueLng: null,
      isFree: false,
      admissionPrice: null,
      websiteUrl: normalizeExternalUrl(fields.get("URL")) ?? source.url,
      categories: categories(source),
      organizerName: source.organizerName ?? "COMC Calendar",
      sourceUrl: source.url,
    });
  }

  return shows;
}

function getScdArticle(html: string) {
  const findArticle = (value: unknown): Record<string, unknown> | null => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const article = findArticle(item);
        if (article) return article;
      }
      return null;
    }
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.articleBody === "string") return record;
    for (const nested of Object.values(record)) {
      const article = findArticle(nested);
      if (article) return article;
    }
    return null;
  };

  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const article = findArticle(JSON.parse(match[1]) as unknown);
      if (article) return article;
    } catch {
      continue;
    }
  }
  return null;
}

function extractWebsite(value: string) {
  const absolute = value.match(/https?:\/\/[^\s;]+/i)?.[0];
  if (absolute) return normalizeExternalUrl(absolute.replace(/[.,)]$/, ""));
  const domain = value.match(/\b(?:www\.)?[a-z0-9][a-z0-9.-]+\.(?:com|net|org|io)(?:\/[^\s;]*)?/i)?.[0];
  return domain ? normalizeExternalUrl(domain.replace(/[.,)]$/, "")) : null;
}

export function parseSportsCollectorsDigest(html: string, source: PublicImportSource): ImportedShow[] {
  const article = getScdArticle(html);
  const body = typeof article?.articleBody === "string" ? decodeHtml(article.articleBody) : "";
  const modified = typeof article?.dateModified === "string" ? article.dateModified : "";
  const fallbackYear = Number(modified.slice(0, 4)) || new Date().getUTCFullYear();
  if (!body) return [];

  const starts = US_STATES.flatMap((state) => {
    const match = new RegExp(`${state.name}\\s*(?=(?:Awaiting new dates|${MONTH_PATTERN}))`, "i").exec(body);
    return match ? [{ state, index: match.index, contentIndex: match.index + match[0].length }] : [];
  }).sort((a, b) => a.index - b.index);
  const shows: ImportedShow[] = [];

  starts.forEach((section, sectionIndex) => {
    const sectionText = body.slice(section.contentIndex, starts[sectionIndex + 1]?.index ?? body.length);
    const entryMatches = [...sectionText.matchAll(new RegExp(`(?:${MONTH_PATTERN})\\.?\\s+\\d{1,2}(?:\\s*-\\s*\\d{1,2})?`, "gi"))];
    entryMatches.forEach((entryMatch, entryIndex) => {
      const entry = sectionText.slice(entryMatch.index, entryMatches[entryIndex + 1]?.index ?? sectionText.length).trim();
      const dates = parseShowDateRange(entry.slice(0, 80), fallbackYear);
      if (!dates) return;
      const datePrefix = entryMatch[0];
      let details = entry.slice(datePrefix.length).replace(/^\s*,\s*/, "").trim();
      const cityHeader = new RegExp(`^${section.state.code}\\s*,\\s*([^\.]{2,60})\\.\\s*`, "i").exec(details);
      let city = cityHeader?.[1]?.trim() ?? null;
      if (cityHeader) details = details.slice(cityHeader[0].length);

      const location = addressParts(details, city ?? undefined, section.state.code);
      city = city ?? location?.city ?? null;
      if (!city) return;
      const pieces = details.split(/,\s*/).map((part) => part.trim()).filter(Boolean);
      let titleIndex = pieces.findIndex((part) => /show|expo|convention|collectible/i.test(part));
      if (titleIndex < 0) titleIndex = 0;
      let title = pieces[titleIndex] ?? `${city} Sports Card Show`;
      if (!/show|expo|convention/i.test(title)) title = `${city} Sports Card Show`;
      if (!/card|collectible|memorabilia/i.test(`${title} ${details}`)) return;
      const venueName = pieces[titleIndex + 1] && !/\d{3,}/.test(pieces[titleIndex + 1]) ? pieces[titleIndex + 1] : location?.venueName ?? null;
      const admission = details.match(/\bA:\s*([^.;]+)/i)?.[1]?.trim() ?? null;
      const tableCount = Number.parseInt(details.match(/\bT:\s*(\d+)/i)?.[1] ?? "", 10) || null;
      const schedule = details.match(/\bSH:\s*([^.;]+)/i)?.[1] ?? "";

      shows.push({
        externalId: externalId("scd", title, dates.startDate, city, section.state.code),
        title,
        description: entry.slice(0, 1000),
        startDate: dates.startDate,
        endDate: dates.endDate,
        city,
        state: section.state.code,
        venueName,
        venueAddress: location?.venueAddress ?? null,
        venueLat: null,
        venueLng: null,
        isFree: Boolean(admission && /free|\$0\b/i.test(admission)),
        admissionPrice: admission && !/free|\$0\b/i.test(admission) ? admission : null,
        admissionNotes: admission,
        tableCount,
        ...parseTimeRange(schedule),
        websiteUrl: extractWebsite(details) ?? source.url,
        categories: categories(source),
        organizerName: source.organizerName ?? "Sports Collectors Digest",
        sourceUrl: source.url,
      });
    });
  });

  return [...new Map(shows.map((show) => [show.externalId, show])).values()];
}

export function extractDedicatedSourceShows(content: string, source: PublicImportSource) {
  switch (source.adapter) {
    case "comc": return parseComcCalendar(content, source);
    case "premier": return parsePremierShows(content, source);
    case "gas": return parseGasShows(content, source);
    case "scd": return parseSportsCollectorsDigest(content, source);
    default: return null;
  }
}
