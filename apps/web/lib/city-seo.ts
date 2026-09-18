export const MIN_INDEXABLE_CITY_SHOWS = 2;

export function isIndexableCityCount(count: number) {
  return Number.isInteger(count) && count >= MIN_INDEXABLE_CITY_SHOWS;
}
