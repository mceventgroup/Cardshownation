import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, Megaphone } from "lucide-react";
import { getPublicCitiesWithShows as getCitiesWithShows, getPublicUpcomingShows } from "@/lib/public-directory";
import { getStateBySlug, getStatesByCodes } from "@/lib/states";
import { ShowListItem } from "@/components/shows/show-list-item";
import { slugify } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/safe-json-ld";
import { absoluteSiteUrl } from "@/lib/site-url";
import { getStateSeo, parseStatePage, STATE_PAGE_SIZE, statePagePath } from "@/lib/state-seo";
import { DALLAS_FORT_WORTH_PATH, WISCONSIN_WEEKEND_PATH } from "@/lib/local-calendars";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ state: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

// Share one data snapshot between metadata and rendered content in this request.
const getStateDirectory = cache(async (code: string, page: number) => {
  const [result, cities] = await Promise.all([
    getPublicUpcomingShows({ state: code, limit: STATE_PAGE_SIZE, offset: (page - 1) * STATE_PAGE_SIZE }),
    getCitiesWithShows(code),
  ]);
  if (page > 1 && result.shows.length === 0) notFound();
  return { ...result, cities };
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { state } = await params;
  const stateRecord = getStateBySlug(state);

  if (!stateRecord) return {};

  const page = parseStatePage((await searchParams).page);
  if (page === null) notFound();
  const { total } = await getStateDirectory(stateRecord.code, page);
  const { title, description, path } = getStateSeo(stateRecord, page);

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: total === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: absoluteSiteUrl(path),
    },
  };
}

export default async function StatePage({ params, searchParams }: Props) {
  const { state } = await params;
  const stateRecord = getStateBySlug(state);

  if (!stateRecord) notFound();

  const page = parseStatePage((await searchParams).page);
  if (page === null) notFound();
  const { shows, total, cities } = await getStateDirectory(stateRecord.code, page);
  const { title, description, guide, path: pagePath } = getStateSeo(stateRecord, page);
  const nearbyStates = getStatesByCodes(guide.nearby);
  const pageCount = Math.max(1, Math.ceil(total / STATE_PAGE_SIZE));
  const firstResult = (page - 1) * STATE_PAGE_SIZE + 1;

  const freeShows = shows.filter((show) => show.isFree).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": absoluteSiteUrl(`${pagePath}#directory`),
        name: title,
        description,
        url: absoluteSiteUrl(pagePath),
        about: { "@type": "State", name: stateRecord.name, containedInPlace: { "@type": "Country", name: "United States" } },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: shows.length,
          itemListElement: shows.map((show, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteSiteUrl(`/shows/${show.slug}`),
            name: show.title,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteSiteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Card Shows", item: absoluteSiteUrl("/card-shows") },
          { "@type": "ListItem", position: 3, name: stateRecord.name, item: absoluteSiteUrl(statePagePath(stateRecord.slug)) },
          ...(page > 1 ? [{ "@type": "ListItem", position: 4, name: `Page ${page}`, item: absoluteSiteUrl(pagePath) }] : []),
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <div className="container-wide py-10">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="transition-colors hover:text-brand-700">
            Home
          </Link>
          <span>/</span>
          <Link href="/card-shows" className="transition-colors hover:text-brand-700">
            Card shows
          </Link>
          <span>/</span>
          <span className="text-slate-900">{stateRecord.name}</span>
          {page > 1 && <><span>/</span><span>Page {page}</span></>}
        </nav>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            State directory
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Upcoming {stateRecord.name} card shows
            {page > 1 && ` — Page ${page}`}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Find sports card, Pokémon, and trading card game shows in {stateRecord.name}.
            Compare event dates, venues, admission details, and organizer links before you go.
          </p>
          {page === 1 && (
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Planning a visit from {guide.cities.join(", ")}, or elsewhere in {stateRecord.name}?
              {" "}{cities.length > 0 ? "Use the city links below to see where upcoming shows are currently listed." : "Check back for new dates or submit an event for review."}
            </p>
          )}
          <a href="#upcoming-shows" className="mt-4 inline-block text-sm font-semibold text-brand-700 underline underline-offset-4">
            See upcoming dates and venues
          </a>
          {page === 1 && (stateRecord.code === "WI" || stateRecord.code === "TX") && (
            <Link className="mt-2 block text-sm font-semibold text-brand-700 underline underline-offset-4"
              href={stateRecord.code === "WI" ? WISCONSIN_WEEKEND_PATH : DALLAS_FORT_WORTH_PATH}>
              {stateRecord.code === "WI" ? "Wisconsin shows this weekend" : "Dallas–Fort Worth card shows"}
            </Link>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Upcoming shows</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {total}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Cities covered</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {cities.length}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Free shows on this page</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {freeShows}
              </p>
            </div>
          </div>
        </section>

        {page === 1 && cities.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-700" />
              <h2 className="text-lg font-semibold text-slate-950">
                Browse {stateRecord.name} by city
              </h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {cities.map(({ city, count }) => (
                <Link
                  key={city}
                  href={`/card-shows/${stateRecord.slug}/${slugify(city)}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  {city}
                  <span className="ml-2 text-xs text-slate-400">{count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="upcoming-shows" className="mt-10 scroll-mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand-700" />
              <h2 className="text-2xl font-semibold text-slate-950">
                Shows in {stateRecord.name}
              </h2>
            </div>
            <Link
              href="/submit-show"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Submit a show in {stateRecord.name}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {total > 0 && (
            <p className="mt-4 text-sm text-slate-600">
              Showing {firstResult}–{firstResult + shows.length - 1} of {total} upcoming {stateRecord.name} listings.
              {" "}Open a show for its full schedule and organizer details. Confirm dates and admission with the organizer before traveling.
            </p>
          )}

          {shows.length === 0 ? (
            <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-lg font-semibold text-slate-900">
                No upcoming shows are listed in {stateRecord.name} yet.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Know an upcoming sports card, Pokémon, or TCG event in {stateRecord.name}?
                {" "}Submit the date, venue, and organizer link for review. You can also explore the other state calendars below.
              </p>
              <Link
                href="/submit-show"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Submit a show
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              {shows.map((show) => (
                <ShowListItem key={show.id} show={show} />
              ))}
            </div>
          )}
        </section>

        {pageCount > 1 && (
          <nav aria-label="Show listing pages" className="mt-6 flex flex-wrap items-center gap-3">
            {page > 1 && <Link prefetch={false} href={statePagePath(stateRecord.slug, page - 1)} rel="prev" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-brand-700">Previous page</Link>}
            <span className="text-sm text-slate-600">Page {page} of {pageCount}</span>
            {page < pageCount && <Link prefetch={false} href={statePagePath(stateRecord.slug, page + 1)} rel="next" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-brand-700">Next page</Link>}
            {page > 2 && <Link prefetch={false} href={statePagePath(stateRecord.slug)} className="text-sm font-semibold text-brand-700">First page</Link>}
          </nav>
        )}

        {page === 1 && (
          <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-slate-950">Planning a card show trip in {stateRecord.name}</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{guide.planning}</p>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Check each listing for the card categories you collect, whether sports cards, Pokémon, or other TCGs.
              Admission, vendor tables, and opening hours vary by event; a missing price does not mean free entry.
            </p>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-950">
            {nearbyStates.length > 0 ? `Card shows near ${stateRecord.name}` : "Explore more card show calendars"}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {nearbyStates.map(nearby => (
              <Link key={nearby.code} prefetch={false} href={statePagePath(nearby.slug)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:border-brand-300">
                {nearby.name} card shows
              </Link>
            ))}
            <Link href="/card-shows" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:border-brand-300">All states</Link>
          </div>
        </section>

        <section className="mt-12 rounded-[2rem] bg-slate-950 px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-brand-300">
                <Megaphone className="h-4 w-4" />
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                  Promoter callout
                </p>
              </div>
              <h2 className="mt-3 text-2xl font-semibold">
                Organizing a show in {stateRecord.name}?
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                Help collectors find your {stateRecord.name} event. Submit your dates, venue,
                admission details, and organizer link for review and inclusion in this calendar.
              </p>
            </div>

            <Link
              href="/submit-show"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
            >
              Submit your show
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
