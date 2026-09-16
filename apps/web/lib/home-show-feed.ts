import { formatApproximateLocation, getApproximateRequestLocation } from "@/lib/request-location";
import { getStateByCode } from "@/lib/states";
import type { ShowCard } from "@/types";

export const HOME_SHOW_RADIUS_MILES = 100;

type FeedQueries = {
  upcoming: (options: { state?: string; limit: number }) => Promise<{ shows: ShowCard[] }>;
  nearby: (options: { lat: number; lng: number; radiusMiles: number; limit: number }) => Promise<ShowCard[]>;
};

export async function getHomeShowFeed(
  requestHeaders: Pick<Headers, "get">,
  preferredStateCode: string | undefined,
  queries: FeedQueries,
) {
  const preferredState = getStateByCode(preferredStateCode);
  const location = getApproximateRequestLocation(requestHeaders);
  const detectedState = requestHeaders.get("x-vercel-ip-country") === "US"
    ? getStateByCode(requestHeaders.get("x-vercel-ip-country-region"))
    : null;
  const state = preferredState ?? (!location ? detectedState : null);

  if (state) {
    const { shows } = await queries.upcoming({ state: state.code, limit: 8 });
    return {
      shows,
      title: `Upcoming shows in ${state.name}`,
      description: preferredState ? "Based on your saved state." : "Based on your approximate internet location.",
      href: `/card-shows/${state.slug}`,
      linkLabel: "View all",
      emptyMessage: `No upcoming shows listed in ${state.name} yet. Try another state or use your location to search nearby.`,
    };
  }

  if (location) {
    const shows = await queries.nearby({ ...location, radiusMiles: HOME_SHOW_RADIUS_MILES, limit: 8 });
    const label = formatApproximateLocation(location);
    return {
      shows,
      title: label ? `Upcoming shows near ${label}` : "Upcoming shows near you",
      description: `Within ${HOME_SHOW_RADIUS_MILES} miles of your approximate internet location. Use your location or choose a state to refine results.`,
      href: "/card-shows",
      linkLabel: "Browse all",
      emptyMessage: `No upcoming shows found within ${HOME_SHOW_RADIUS_MILES} miles. Choose a state or use your location to try another area.`,
    };
  }

  const { shows } = await queries.upcoming({ limit: 8 });
  return {
    shows,
    title: "Upcoming shows",
    description: "Showing nationwide. Choose your state or use your location for local shows.",
    href: "/card-shows",
    linkLabel: "View all",
    emptyMessage: "No upcoming shows are available right now. Please check back soon.",
  };
}
