import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, Megaphone } from "lucide-react";
import { ShowListItem } from "@/components/shows/show-list-item";
import { getShowsByCity, getCitiesWithShows } from "@/lib/shows";
import { getStateBySlug } from "@/lib/states";
import { slugify } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/safe-json-ld";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ state: string; city: string }>;
};

async function resolveCityName(stateCode: string, citySlug: string): Promise<string | null> {
  const cities = await getCitiesWithShows(stateCode);
  const match = cities.find((c) => slugify(c.city) === citySlug);
  return match?.city ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, city } = await params;
  const stateRecord = getStateBySlug(state);
  if (!stateRecord) return {};

  const cityName = await resolveCityName(stateRecord.code, city);
  if (!cityName) return {};

  return {
    title: `${cityName}, ${stateRecord.name} Card Shows`,
    description: `Find upcoming sports card, Pokemon, and TCG shows in ${cityName}, ${stateRecord.name}. Browse dates, venues, and admission details on Card Show Nation.`,
  };
}

export default async function CityPage({ params }: Props) {
  const { state, city } = await params;
  const stateRecord = getStateBySlug(state);
  if (!stateRecord) notFound();

  const cityName = await resolveCityName(stateRecord.code, city);
  if (!cityName) notFound();

  const shows = await getShowsByCity(stateRecord.code, cityName, 50);
  const freeShows = shows.filter((s) => s.isFree).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cityName}, ${stateRecord.name} Card Shows`,
    description: `Upcoming card shows in ${cityName}, ${stateRecord.name} listed on Card Show Nation.`,
    url: `https://cardshownation.com/card-shows/${stateRecord.slug}/${city}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: shows.map((show, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://cardshownation.com/shows/${show.slug}`,
        name: show.title,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <div className="container-wide py-10">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="transition-colors hover:text-brand-700">Home</Link>
          <span>/</span>
          <Link href="/card-shows" className="transition-colors hover:text-brand-700">Card shows</Link>
          <span>/</span>
          <Link href={`/card-shows/${stateRecord.slug}`} className="transition-colors hover:text-brand-700">
            {stateRecord.name}
          </Link>
          <span>/</span>
          <span className="text-slate-900">{cityName}</span>
        </nav>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            City directory
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Upcoming {cityName}, {stateRecord.name} card shows
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Browse upcoming shows in {cityName} with event dates, venue details, admission info, and promoter links.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Upcoming shows</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{shows.length}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Free admission</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{freeShows}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">State</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{stateRecord.name}</p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand-700" />
              <h2 className="text-2xl font-semibold text-slate-950">
                Shows in {cityName}
              </h2>
            </div>
            <Link
              href="/submit-show"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Submit a show in {cityName}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {shows.length === 0 ? (
            <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-lg font-semibold text-slate-900">
                No upcoming shows are listed in {cityName} yet.
              </p>
              <div className="mt-4 flex flex-col items-center gap-3 text-sm">
                <Link
                  href={`/card-shows/${stateRecord.slug}`}
                  className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
                >
                  Browse all {stateRecord.name} shows
                </Link>
                <Link href="/submit-show" className="font-semibold text-brand-700 transition-colors hover:text-brand-800">
                  Submit a show
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              {shows.map((show) => (
                <ShowListItem key={show.id} show={show} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-700" />
            <h2 className="text-lg font-semibold text-slate-950">
              More in {stateRecord.name}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/card-shows/${stateRecord.slug}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              All {stateRecord.name} shows
            </Link>
          </div>
        </section>

        <section className="mt-12 rounded-[2rem] bg-slate-950 px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-brand-300">
                <Megaphone className="h-4 w-4" />
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">Promoter callout</p>
              </div>
              <h2 className="mt-3 text-2xl font-semibold">
                Organizing a show in {cityName}?
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                Submit your show to get listed in the {cityName} directory. Free to list — collectors check here first.
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
