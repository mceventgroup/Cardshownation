import { cachePublicDirectoryQuery } from "@/lib/public-directory-cache";
import { normalizeDirectoryOptions, restoreShowCardDates, type DirectoryOptions } from "@/lib/public-directory-data";
import { getUpcomingShows, getHomepageDirectoryStats, getShowsByState, getShowsByCity, getCitiesWithShows, getStatesWithShows } from "@/lib/shows";

const upcoming = cachePublicDirectoryQuery("upcoming", getUpcomingShows);
const byState = cachePublicDirectoryQuery("state", getShowsByState);
const byCity = cachePublicDirectoryQuery("city", getShowsByCity);
export const getPublicDirectoryStats = cachePublicDirectoryQuery("stats", getHomepageDirectoryStats);
export const getPublicCitiesWithShows = cachePublicDirectoryQuery("cities", getCitiesWithShows);
export const getPublicStatesWithShows = cachePublicDirectoryQuery("states", getStatesWithShows);

export async function getPublicUpcomingShows(options: DirectoryOptions) {
  const result = await upcoming(normalizeDirectoryOptions(options));
  return { ...result, shows: restoreShowCardDates(result.shows) };
}

export async function getPublicShowsByState(state: string, limit = 24) {
  return restoreShowCardDates(await byState(state, limit));
}

export async function getPublicShowsByCity(state: string, city: string, limit = 24) {
  return restoreShowCardDates(await byCity(state, city, limit));
}
