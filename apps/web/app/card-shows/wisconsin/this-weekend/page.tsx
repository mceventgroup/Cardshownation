import type { Metadata } from "next";
import { cache } from "react";
import { LocalShowCalendar } from "@/components/shows/local-show-calendar";
import { getWeekendCalendar, WISCONSIN_WEEKEND_PATH } from "@/lib/local-calendars";
import { getPublicCalendarShows } from "@/lib/public-directory";
import { formatShowDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const title = "Wisconsin Card Shows This Weekend";
const description = "Find sports card, Pokémon, and TCG shows in Wisconsin this weekend. Check listings for Milwaukee-area, Madison, Green Bay, and other Wisconsin venues.";
const loadCalendar = cache(async () => {
  const dates = getWeekendCalendar();
  return { ...dates, shows: await getPublicCalendarShows("WI", dates.from, dates.before) };
});

export async function generateMetadata(): Promise<Metadata> {
  const { shows } = await loadCalendar();
  return { title, description, alternates: { canonical: WISCONSIN_WEEKEND_PATH }, robots: shows.length ? undefined : { index: false, follow: true } };
}

export default async function WisconsinWeekendPage() {
  const { friday, sunday, shows } = await loadCalendar();
  return <LocalShowCalendar title={title} description={description}
    dateLabel={formatShowDate(friday, sunday)} path={WISCONSIN_WEEKEND_PATH}
    parentPath="/card-shows/wisconsin" parentName="Wisconsin card shows" shows={shows} />;
}
