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
) {
  const preferredState = getStateByCode(preferredStateCode);
  // Explicit choices skip the external lookup entirely. IP estimates select a
  // state, not a city-radius cutoff that can hide relevant statewide shows.
  const state = preferredState ?? await (queries.detectState ?? getRequestState)(requestHeaders);

  if (state) {
    const { shows } = await queries.upcoming({ state: state.code, limit: 8 });
    return {
      shows,
      title: `Upcoming shows in ${state.name}`,
      description: preferredState ? "Based on your saved state." : "Showing statewide based on your approximate internet location. Choose your state below if this looks wrong.",
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
