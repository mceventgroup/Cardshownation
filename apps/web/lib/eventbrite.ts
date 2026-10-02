const EVENTBRITE_API = "https://www.eventbriteapi.com/v3";
const CARD_SHOW_KEYWORDS = [
  "card show",
  "sports card show",
  "trading card show",
  "pokemon card show",
  "sports card expo",
  "card expo",
  "card collector show",
];

type EventbriteVenue = {
  id: string;
  name: string;
  address: {
    address_1: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    latitude: string | null;
    longitude: string | null;
  };
};

type EventbriteOrganizer = {
  id: string;
  name: string;
  website: string | null;
};

type EventbriteEvent = {
  id: string;
  name: { text: string };
  description: { text: string | null };
  start: { utc: string; local: string };
  end: { utc: string; local: string };
  url: string;
  is_free: boolean;
  ticket_availability?: { minimum_ticket_price?: { display: string } };
  venue?: EventbriteVenue;
  organizer?: EventbriteOrganizer;
  category_id?: string;
};

type EventbriteSearchResponse = {
  events: EventbriteEvent[];
  pagination: {
    page_count: number;
    page_number: number;
    has_more_items: boolean;
    continuation?: string;
  };
};

export type MappedShow = {
  externalId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  city: string;
  state: string;
  venueName: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  isFree: boolean;
  admissionPrice: string | null;
  websiteUrl: string;
  categories: string[];
  organizerName: string | null;
};

function inferCategories(title: string, description: string | null): string[] {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  const cats: string[] = [];
  if (/pokemon|pok[eé]mon/.test(text)) cats.push("Pokemon");
  if (/magic|mtg|gathering/.test(text)) cats.push("Magic: The Gathering");
  if (/yugioh|yu-gi-oh/.test(text)) cats.push("Yu-Gi-Oh");
  if (/sport|baseball|football|basketball|hockey|soccer/.test(text) || cats.length === 0)
    cats.push("Sports Cards");
  return cats;
}

function isCardShow(event: EventbriteEvent): boolean {
  const text = `${event.name.text} ${event.description?.text ?? ""}`.toLowerCase();
  return CARD_SHOW_KEYWORDS.some((kw) => text.includes(kw));
}

async function fetchPage(
  apiKey: string,
  keyword: string,
  page: number
): Promise<EventbriteSearchResponse> {
  const params = new URLSearchParams({
    q: keyword,
    "location.country": "US",
    expand: "venue,organizer,ticket_availability",
    page: String(page),
    page_size: "50",
    sort_by: "date",
    "start_date.range_start": new Date().toISOString().split("T")[0] + "T00:00:00Z",
  });

  const res = await fetch(`${EVENTBRITE_API}/events/search/?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Eventbrite API error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export async function fetchCardShowsFromEventbrite(apiKey: string, options: { pageLimit?: number; onError?: (error: string) => void } = {}): Promise<MappedShow[]> {
  const seen = new Set<string>();
  const results: MappedShow[] = [];

  for (const keyword of CARD_SHOW_KEYWORDS) {
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= (options.pageLimit ?? 3)) {
        const data = await fetchPage(apiKey, keyword, page);

        for (const event of data.events) {
          if (seen.has(event.id)) continue;
          if (!isCardShow(event)) continue;

          const city = event.venue?.address.city;
          const state = event.venue?.address.region;
          if (!city || !state || state.length !== 2) continue;

          seen.add(event.id);

          const lat = event.venue?.address.latitude ? parseFloat(event.venue.address.latitude) : null;
          const lng = event.venue?.address.longitude ? parseFloat(event.venue.address.longitude) : null;

          results.push({
            externalId: `eventbrite:${event.id}`,
            title: event.name.text,
            description: event.description?.text?.slice(0, 1000) || null,
            startDate: new Date(event.start.utc),
            endDate: new Date(event.end.utc),
            city,
            state: state.toUpperCase(),
            venueName: event.venue?.name ?? null,
            venueAddress: event.venue?.address.address_1 ?? null,
            venueLat: isNaN(lat!) ? null : lat,
            venueLng: isNaN(lng!) ? null : lng,
            isFree: event.is_free,
            admissionPrice: event.is_free
              ? null
              : (event.ticket_availability?.minimum_ticket_price?.display ?? null),
            websiteUrl: event.url,
            categories: inferCategories(event.name.text, event.description?.text ?? null),
            organizerName: event.organizer?.name ?? null,
          });
        }

        hasMore = data.pagination.has_more_items;
        page++;
      }
      if (hasMore) options.onError?.(`${keyword}: pagination limit reached`);
    } catch (error) {
      options.onError?.(`${keyword}: ${error instanceof Error ? error.message : String(error)}`);
      // continue with next keyword if one fails
    }
  }

  return results;
}
