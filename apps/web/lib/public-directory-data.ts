import type { ShowCard } from "@/types";

export type DirectoryOptions = {
  state?: string; city?: string; category?: string; isFree?: boolean;
  q?: string; limit?: number; offset?: number;
};

// A stable shape shares entries regardless of a caller's object property order.
export function normalizeDirectoryOptions(options: DirectoryOptions) {
  return {
    state: options.state ?? "", city: options.city ?? "", category: options.category ?? "",
    isFree: options.isFree, q: options.q ?? "", limit: options.limit ?? 24, offset: options.offset ?? 0,
  };
}

// Next's persistent cache uses JSON, so Date objects need rehydrating on hits.
export function restoreShowCardDates(shows: ShowCard[]): ShowCard[] {
  return shows.map(show => ({ ...show, startDate: new Date(show.startDate), endDate: new Date(show.endDate) }));
}
