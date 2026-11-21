import type { Metadata } from "next";
import { cache } from "react";
import { LocalShowCalendar } from "@/components/shows/local-show-calendar";
import { DALLAS_FORT_WORTH_CITIES, DALLAS_FORT_WORTH_PATH, getDallasFortWorthCalendar } from "@/lib/local-calendars";
import { getPublicCalendarShows } from "@/lib/public-directory";

export const dynamic = "force-dynamic";
const title = "Dallas–Fort Worth Card Shows";
const description = "Browse upcoming sports card, Pokémon, and TCG shows in Dallas–Fort Worth and nearby cities, including Arlington, Allen, Frisco, Plano, and Waxahachie.";
const loadCalendar = cache(() => {
  const { from, before } = getDallasFortWorthCalendar();
  return getPublicCalendarShows("TX", from, before, DALLAS_FORT_WORTH_CITIES);
});

export async function generateMetadata(): Promise<Metadata> {
  const shows = await loadCalendar();
  return { title, description, alternates: { canonical: DALLAS_FORT_WORTH_PATH }, robots: shows.length ? undefined : { index: false, follow: true } };
}

export default async function DallasFortWorthPage() {
  return <LocalShowCalendar title={title} description={description}
    dateLabel="Upcoming shows over the next 90 days" path={DALLAS_FORT_WORTH_PATH}
    parentPath="/card-shows/texas" parentName="Texas card shows" shows={await loadCalendar()} />;
}
