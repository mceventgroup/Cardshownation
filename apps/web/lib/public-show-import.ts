import {
  getAllPublicImportSources,
  parsePublicImportSources,
  type PublicImportSource,
} from "@/lib/auto-import-sources";
import { ingestImportedShows, type ImportSourceSummary, type ImportedShow } from "@/lib/show-import-ingest";
import { getStateByCode, US_STATES } from "@/lib/states";
import { normalizeExternalUrl } from "@/lib/url";
import { fetchPublicUrl, readResponseTextLimited } from "@/lib/safe-remote-fetch";

const CARD_SHOW_PATTERN =
  /\b(card show|sports card show|trading card show|pokemon card show|card expo|sports card expo|collector show|collectibles show)\b/i;

const DATE_RANGE_PATTERN =
  /\b([A-Z][a-z]+ \d{1,2}, \d{4})(?:\s*(?:-|to|through)\s*([A-Z][a-z]+ \d{1,2}, \d{4}))?\b/;
const DATE_RANGE_WITH_OPTIONAL_YEAR_PATTERN =
  /\b([A-Z][a-z]+ \d{1,2}(?:,\s*\d{4})?)(?:\s*(?:-|to|through)\s*([A-Z][a-z]+ \d{1,2}(?:,\s*\d{4})?))?\b/;

type JsonLdNode = Record<string, unknown>;
type SourceAdapter = {
  extractShows: (html: string, source: PublicImportSource) => ImportedShow[];
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function stripHtmlPreserveLines(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/ul|\/ol|\/section|\/article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
  );
}

function inferCategories(title: string, description: string | null, fallback: string[] = []) {
  if (fallback.length > 0) {
    return fallback;
  }

  const text = `${title} ${description ?? ""}`.toLowerCase();
  const categories: string[] = [];
  if (/pokemon|pok[eé]mon/.test(text)) categories.push("Pokemon");
  if (/magic|mtg|gathering/.test(text)) categories.push("Magic: The Gathering");
  if (/yu-gi-oh|yugioh/.test(text)) categories.push("Yu-Gi-Oh");
  if (/sport|baseball|football|basketball|hockey|soccer/.test(text) || categories.length === 0) {
    categories.push("Sports Cards");
  }
  return categories;
}

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function flattenJsonLd(input: unknown): JsonLdNode[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((entry) => flattenJsonLd(entry));
  }

  const node = input as JsonLdNode;
  const graph = node["@graph"];
  if (Array.isArray(graph)) {
    return graph.flatMap((entry) => flattenJsonLd(entry));
  }

  return [node];
}

function getJsonLdNodes(html: string): JsonLdNode[] {
  const matches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  const nodes: JsonLdNode[] = [];

  for (const match of matches) {
    const raw = decodeHtmlEntities(match[1]).trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      nodes.push(...flattenJsonLd(parsed));
    } catch {
      continue;
    }
  }

  return nodes;
}

function getTypeNames(node: JsonLdNode) {
  return ensureArray(node["@type"]).filter((value): value is string => typeof value === "string");
}

function isEventNode(node: JsonLdNode) {
  return getTypeNames(node).some((value) => value.toLowerCase().includes("event"));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseDate(value: unknown) {
  const text = readString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addressParts(location: JsonLdNode | null) {
  if (!location) {
    return {
      venueName: null,
      venueAddress: null,
      city: null,
      state: null,
    };
  }

  const address = location.address;
  const addressNode =
    address && typeof address === "object" && !Array.isArray(address)
      ? (address as JsonLdNode)
      : null;

  return {
    venueName: readString(location.name),
    venueAddress: readString(addressNode?.streetAddress),
    city: readString(addressNode?.addressLocality),
    state: readString(addressNode?.addressRegion)?.toUpperCase() ?? null,
  };
}

function priceFromOffers(value: unknown) {
  const offers = ensureArray(value).find(
    (entry): entry is JsonLdNode => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  );

  if (!offers) return { isFree: false, admissionPrice: null as string | null };

  const price = readString(offers.price);
  const currency = readString(offers.priceCurrency);
  const isFree = price === "0" || price === "0.00" || /free/i.test(readString(offers.category) ?? "");

  if (isFree) {
    return { isFree: true, admissionPrice: null };
  }

  if (!price) {
    return { isFree: false, admissionPrice: null };
  }

  return {
    isFree: false,
    admissionPrice: currency ? `${currency} ${price}` : price,
  };
}

function buildExternalId(source: PublicImportSource, url: string, title: string, startDate: Date) {
  return [
    "public",
    source.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    normalizeExternalUrl(url) ?? url,
    title.trim().toLowerCase(),
    startDate.toISOString().slice(0, 10),
  ].join(":");
}

function isLikelyCardShow(title: string, description: string | null) {
  return CARD_SHOW_PATTERN.test(`${title} ${description ?? ""}`);
}

function mapJsonLdEvent(node: JsonLdNode, source: PublicImportSource, sourceUrl: string): ImportedShow | null {
  const title = readString(node.name);
  const description = readString(node.description);
  const startDate = parseDate(node.startDate);
  const endDate = parseDate(node.endDate) ?? startDate;
  if (!title || !startDate || !endDate) {
    return null;
  }
  if (!isLikelyCardShow(title, description)) {
    return null;
  }

  const locationNode =
    node.location && typeof node.location === "object" && !Array.isArray(node.location)
      ? (node.location as JsonLdNode)
      : null;
  const location = addressParts(locationNode);
  const city = location.city ?? source.city ?? null;
  const state = location.state ?? source.state?.toUpperCase() ?? null;
  if (!city || !state) {
    return null;
  }

  const pricing = priceFromOffers(node.offers);
  const eventUrl = readString(node.url) ?? sourceUrl;

  return {
    externalId: buildExternalId(source, eventUrl, title, startDate),
    title,
    description,
    startDate,
    endDate,
    city,
    state,
    venueName: location.venueName,
    venueAddress: location.venueAddress,
    venueLat: null,
    venueLng: null,
    isFree: pricing.isFree,
    admissionPrice: pricing.admissionPrice,
    websiteUrl: eventUrl,
    facebookUrl: source.facebookUrl ?? (/facebook\.com/i.test(eventUrl) ? eventUrl : null),
    categories: inferCategories(title, description, source.categories),
    organizerName: source.organizerName ?? null,
    sourceUrl,
  };
}

function extractMetaContent(html: string, property: string) {
  const match = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
  );
  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : null;
}

function extractTitle(html: string) {
  return (
    extractMetaContent(html, "og:title") ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ??
    null
  );
}

function parseLooseDate(text: string) {
  const match = text.match(DATE_RANGE_PATTERN);
  if (!match) return null;

  const startDate = new Date(match[1]);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const endDate = match[2] ? new Date(match[2]) : startDate;
  if (Number.isNaN(endDate.getTime())) {
    return null;
  }

  return { startDate, endDate };
}

function normalizeDateYear(text: string) {
  return /\d{4}/.test(text) ? text : `${text}, ${new Date().getFullYear()}`;
}

function parseLooseDateFlexible(text: string) {
  const match = text.match(DATE_RANGE_WITH_OPTIONAL_YEAR_PATTERN);
  if (!match) return null;

  const startDate = new Date(normalizeDateYear(match[1]));
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const endDate = match[2] ? new Date(normalizeDateYear(match[2])) : startDate;
  if (Number.isNaN(endDate.getTime())) {
    return null;
  }

  if (endDate < startDate) {
    endDate.setFullYear(startDate.getFullYear());
  }

  return { startDate, endDate };
}

function extractCityStateFromText(text: string) {
  const compactText = text.replace(/\s+/g, " ").trim();
  const stateCodeMatch = compactText.match(/\b([A-Za-z .'-]+),\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\b/);
  if (stateCodeMatch && getStateByCode(stateCodeMatch[2])) {
    return {
      city: stateCodeMatch[1].trim(),
      state: stateCodeMatch[2].trim(),
    };
  }

  for (const state of US_STATES) {
    const stateNamePattern = new RegExp(`\\b([A-Za-z .'-]+),\\s*${state.name}\\b`, "i");
    const stateNameMatch = compactText.match(stateNamePattern);
    if (stateNameMatch) {
      return {
        city: stateNameMatch[1].trim(),
        state: state.code,
      };
    }
  }

  return { city: null, state: null };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildImportedShowFromBlock(input: {
  source: PublicImportSource;
  title: string | null;
  description: string | null;
  dateText: string | null;
  locationText: string | null;
  url: string | null;
}) {
  if (!input.title) {
    return null;
  }

  const parsedDates = input.dateText ? parseLooseDateFlexible(input.dateText) : null;
  if (!parsedDates) {
    return null;
  }

  const location = extractCityStateFromText(input.locationText ?? input.description ?? "");
  const city = input.source.city ?? location.city;
  const state = input.source.state?.toUpperCase() ?? location.state;
  if (!city || !state) {
    return null;
  }

  const normalizedUrl = input.url ? normalizeExternalUrl(input.url) : input.source.url;
  const externalId = [
    "public",
    input.source.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    normalizedUrl ?? input.source.url,
    input.title.trim().toLowerCase(),
    parsedDates.startDate.toISOString().slice(0, 10),
  ].join(":");

  return {
    externalId,
    title: input.title,
    description: input.description,
    startDate: parsedDates.startDate,
    endDate: parsedDates.endDate,
    city,
    state,
    venueName: null,
    venueAddress: null,
    venueLat: null,
    venueLng: null,
    isFree: false,
    admissionPrice: null,
    websiteUrl: normalizedUrl,
    facebookUrl: input.source.facebookUrl ?? null,
    categories: inferCategories(input.title, input.description, input.source.categories),
    organizerName: input.source.organizerName ?? "Beckett",
    sourceUrl: input.source.url,
  } satisfies ImportedShow;
}

function extractBeckettShowsFromHtml(html: string, source: PublicImportSource) {
  const articlePattern =
    /<(article|div)[^>]*class=["'][^"']*(?:post|event|item|entry|row|card)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = html.matchAll(articlePattern);
  const shows = new Map<string, ImportedShow>();

  for (const match of matches) {
    const blockHtml = match[2] ?? "";
    const blockText = stripHtmlPreserveLines(blockHtml);
    const compactText = normalizeWhitespace(blockText);
    if (!/card|show|event|collect/i.test(compactText)) {
      continue;
    }

    const linkMatch = blockHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const title =
      linkMatch?.[2] ? normalizeWhitespace(stripHtml(linkMatch[2])) : extractTitle(blockHtml) ?? null;
    const dateText = compactText.match(DATE_RANGE_WITH_OPTIONAL_YEAR_PATTERN)?.[0] ?? null;
    const locationLine =
      blockText
        .split("\n")
        .map((line) => normalizeWhitespace(line))
        .find((line) => Boolean(extractCityStateFromText(line).state)) ?? null;

    const show = buildImportedShowFromBlock({
      source,
      title,
      description: compactText.slice(0, 1000) || null,
      dateText,
      locationText: locationLine,
      url: linkMatch?.[1] ? toAbsoluteUrl(source.url, decodeHtmlEntities(linkMatch[1])) : source.url,
    });

    if (show) {
      shows.set(show.externalId, show);
    }
  }

  return [...shows.values()];
}

function resolveSourceAdapter(source: PublicImportSource): SourceAdapter | null {
  const text = `${source.name} ${source.url}`.toLowerCase();
  if (text.includes("beckett")) {
    return {
      extractShows: extractBeckettShowsFromHtml,
    };
  }

  return null;
}

function mapHeuristicShow(html: string, source: PublicImportSource): ImportedShow | null {
  const title = extractTitle(html);
  const text = stripHtmlPreserveLines(html);
  const description = extractMetaContent(html, "description") ?? stripHtml(text).slice(0, 1000);
  if (!title || !isLikelyCardShow(title, description)) {
    return null;
  }

  const parsedDates = parseLooseDate(stripHtml(text));
  const inferredLocation = extractCityStateFromText(text);
  const city = source.city ?? inferredLocation.city;
  const state = source.state?.toUpperCase() ?? inferredLocation.state;
  if (!parsedDates || !city || !state) {
    return null;
  }

  return {
    externalId: buildExternalId(source, source.url, title, parsedDates.startDate),
    title,
    description,
    startDate: parsedDates.startDate,
    endDate: parsedDates.endDate,
    city,
    state,
    venueName: null,
    venueAddress: null,
    venueLat: null,
    venueLng: null,
    isFree: false,
    admissionPrice: null,
    websiteUrl: source.url,
    facebookUrl: source.facebookUrl ?? (/facebook\.com/i.test(source.url) ? source.url : null),
    categories: inferCategories(title, description, source.categories),
    organizerName: source.organizerName ?? null,
    sourceUrl: source.url,
  };
}

function toAbsoluteUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function isLikelyEventLink(url: URL, linkText: string) {
  const text = `${url.pathname} ${url.search} ${linkText}`.toLowerCase();
  return /card|show|event|calendar|schedule|convention|expo|collect/i.test(text);
}

export function extractCandidateEventUrls(html: string, source: PublicImportSource) {
  const baseUrl = new URL(source.url);
  const matches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  const urls = new Set<string>();

  for (const match of matches) {
    const href = match[1]?.trim();
    if (!href) continue;

    const absoluteUrl = toAbsoluteUrl(source.url, decodeHtmlEntities(href));
    if (!absoluteUrl) continue;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(absoluteUrl);
    } catch {
      continue;
    }

    if (parsedUrl.origin !== baseUrl.origin) continue;
    if (parsedUrl.toString() === source.url) continue;
    if (!/^https?:$/i.test(parsedUrl.protocol)) continue;

    const linkText = stripHtml(match[2] ?? "");
    if (!isLikelyEventLink(parsedUrl, linkText)) continue;

    urls.add(parsedUrl.toString());
    if (urls.size >= 12) {
      break;
    }
  }

  return [...urls];
}

export function extractShowsFromHtml(html: string, source: PublicImportSource): ImportedShow[] {
  const adapterShows = resolveSourceAdapter(source)?.extractShows(html, source) ?? [];
  if (adapterShows.length > 0) {
    return adapterShows;
  }

  const jsonLdShows = getJsonLdNodes(html)
    .filter((node) => isEventNode(node))
    .map((node) => mapJsonLdEvent(node, source, source.url))
    .filter((show): show is ImportedShow => Boolean(show));

  if (jsonLdShows.length > 0) {
    const unique = new Map<string, ImportedShow>();
    for (const show of jsonLdShows) {
      unique.set(show.externalId, show);
    }
    return [...unique.values()];
  }

  const heuristic = mapHeuristicShow(html, source);
  return heuristic ? [heuristic] : [];
}

async function fetchSourceHtml(source: PublicImportSource) {
  const response = await fetchPublicUrl(source.url, {
    headers: {
      "user-agent": "Card Show Nation Import Bot/1.0 (+https://cardshownation.com)",
      accept: "text/html,application/xhtml+xml",
    },
  }, 15_000);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return readResponseTextLimited(response, 2 * 1024 * 1024);
}

async function crawlLinkedEventPages(source: PublicImportSource, sourceHtml: string) {
  const candidateUrls = extractCandidateEventUrls(sourceHtml, source);
  const collected = new Map<string, ImportedShow>();

  for (const url of candidateUrls) {
    try {
      const html = await fetchSourceHtml({ ...source, url });
      const shows = extractShowsFromHtml(html, { ...source, url });
      for (const show of shows) {
        collected.set(show.externalId, show);
      }
    } catch {
      continue;
    }
  }

  return [...collected.values()];
}

export async function runPublicSourceImports() {
  const sources = await getAllPublicImportSources();
  const results: ImportSourceSummary[] = [];

  for (const source of sources) {
    try {
      const html = await fetchSourceHtml(source);
      const directShows = extractShowsFromHtml(html, source);
      const linkedShows = await crawlLinkedEventPages(source, html);
      const showMap = new Map<string, ImportedShow>();
      for (const show of [...directShows, ...linkedShows]) {
        showMap.set(show.externalId, show);
      }
      const shows = [...showMap.values()];
      const result = await ingestImportedShows({
        source: `public:${source.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: source.name,
        submitterName: `${source.name} Import`,
        submitterEmail: "import@cardshownation.com",
        shows,
      });
      results.push(result);
    } catch (err) {
      results.push({
        source: `public:${source.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: source.name,
        imported: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  return results;
}
