import type { DirectoryState } from "./states";
import { STATE_GUIDES } from "./state-guides";

export const STATE_PAGE_SIZE = 24;

export function parseStatePage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 10000 ? page : null;
}

export function statePagePath(slug: string, page = 1) {
  return `/card-shows/${slug}${page > 1 ? `?page=${page}` : ""}`;
}

export function getStateSeo(state: DirectoryState, page = 1) {
  const guide = STATE_GUIDES[state.code];
  const cities = guide.cities.slice(0, 2).join(" and ");
  const title = `${state.name} Card Shows${page > 1 ? ` - Page ${page}` : " | Dates & Venues"}`;
  const description = page > 1
    ? `More upcoming ${state.name} card shows, page ${page}. Compare sports card, Pokémon and TCG event dates, venues and admission details.`
    : `${state.name} card shows: sports cards, Pokémon & TCG events. Find dates, venues and admission details; plan a visit from ${cities}.`;
  return { title, description, guide, path: statePagePath(state.slug, page) };
}
