import { getRequestState } from "@/lib/ip-state";
import { getStateByCode } from "@/lib/states";
import type { ShowCard } from "@/types";

type FeedQueries = {
  upcoming: (options: { state?: string; limit: number }) => Promise<{ shows: ShowCard[] }>;
  detectState?: typeof getRequestState;
};

export async function getHomeShowFeed(
  requestHeaders: Pick<Headers, "get">,
  preferredStateCode: string | undefined,
  queries: FeedQueries,
  selectedStateCode?: string,
) {
  const preferredState = getStateByCode(preferredStateCode);
  const selectedState = getStateByCode(selectedStateCode);
  // Only a state explicitly selected in this URL overrides the current IP.
  // Old account/cookie preferences must not pin visitors to a previous location.
  const detectedState = selectedState ? null : await (queries.detectState ?? getRequestState)(requestHeaders);
  const state = selectedState ?? detectedState ?? preferredState;

  if (state) {
    const { shows } = await queries.upcoming({ state: state.code, limit: 8 });
    return {
      shows,
      title: `Upcoming shows in ${state.name}`,
      description: selectedState ? "Based on the state you selected. Choose Use my IP location below to detect your area automatically."
        : detectedState ? "Showing statewide based on your approximate internet location. Choose your state below if this looks wrong."
          : "We could not estimate your internet location. Showing your saved state instead.",
      href: `/card-shows/${state.slug}`,
      linkLabel: "View all",
      emptyMessage: `No upcoming shows listed in ${state.name} yet. Try another state or use your location to search nearby.`,
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
