import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { ShowCard } from "@/components/shows/show-card";
import { ShowListItem } from "@/components/shows/show-list-item";
import { NearMeButton } from "@/components/shows/near-me-button";
import { NearbyShowResults } from "@/components/shows/nearby-show-results";
import { ViewToggle } from "@/components/shows/view-toggle";
import { DEFAULT_NEARBY_RADIUS, normalizeNearbyRadius } from "@/lib/nearby-radius";
import { SHOW_CATEGORIES, getUpcomingShows } from "@/lib/shows";
import { US_STATES, getStateByCode } from "@/lib/states";
import { StateDirectory } from "@/components/shows/state-directory";
import { serializeJsonLd } from "@/lib/safe-json-ld";
import { absoluteSiteUrl } from "@/lib/site-url";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type SearchParams = {
  state?: string;
  city?: string;
  category?: string;
  free?: string;
  q?: string;
  page?: string;
  nearby?: string;
  lat?: string;
  lng?: string;
  radius?: string;
  view?: string;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const hasSearchVariant = Object.entries(sp).some(
    ([key, value]) => key !== "view" && Boolean(value)
  );
  const title = "Browse Upcoming Card Shows";
  const description =
    "Search the free Card Show Nation database for upcoming sports card, Pokemon, and TCG shows by state, city, venue, promoter, and date.";

  return {
    title,
    description,
    alternates: { canonical: "/card-shows" },
    robots: hasSearchVariant ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: absoluteSiteUrl("/card-shows") },
  };
}

function buildQuery(
  current: SearchParams,
  overrides: Partial<Record<keyof SearchParams, string | undefined>>
) {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };

  Object.entries(merged).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  return params.toString();
}

export default async function CardShowsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  if (sp.lat || sp.lng) {
    redirect("/card-shows");
  }

  const isNearMe = sp.nearby === "1";
  const radiusMiles = normalizeNearbyRadius(sp.radius ?? String(DEFAULT_NEARBY_RADIUS));

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const limit = 18;
  const offset = (page - 1) * limit;

  let shows: Awaited<ReturnType<typeof getUpcomingShows>>["shows"];
  let total: number;

  if (isNearMe) {
    shows = [];
    total = 0;
  } else {
    const result = await getUpcomingShows({
      state: sp.state,
      city: sp.city,
      category: sp.category,
      isFree: sp.free === "1" ? true : undefined,
      q: sp.q,
      limit,
      offset,
    });
    shows = result.shows;
    total = result.total;
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasFilters = Boolean(sp.state || sp.city || sp.category || sp.free || sp.q || isNearMe);
  const stateName = getStateByCode(sp.state)?.name;
  const view = sp.view === "grid" ? "grid" : "list";

  const collectionJsonLd = !hasFilters
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Upcoming Card Shows",
        description:
          "A nationwide directory of upcoming sports card, Pokemon, and trading card shows.",
        url: absoluteSiteUrl("/card-shows"),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: total,
          itemListElement: shows.map((show, index) => ({
            "@type": "ListItem",
            position: offset + index + 1,
            name: show.title,
            url: absoluteSiteUrl(`/shows/${show.slug}`),
          })),
        },
      }
    : null;


  return (
    <>
    {collectionJsonLd && (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionJsonLd) }}
      />
    )}
    <div className="container-wide py-10">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Show directory
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {stateName ? `${stateName} card shows` : "Browse upcoming card shows"}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Search by show name, city, promoter, or venue. Nearby search uses a rounded
          device location only after you choose it.
        </p>

        <form action="/card-shows" method="GET" className="mt-6 space-y-3">
          {/* Search input — full width */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search by show, city, venue, or promoter"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 pl-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none"
            />
          </div>

          {/* State + Category selects side by side on 360px+, stacked below */}
          <div className="grid gap-3 min-[360px]:grid-cols-2">
            <select
              name="state"
              defaultValue={sp.state ?? ""}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
            >
              <option value="">All states</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>

            <select
              name="category"
              defaultValue={sp.category ?? ""}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
            >
              <option value="">All categories</option>
              {SHOW_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Free checkbox + Search button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="free"
                value="1"
                defaultChecked={sp.free === "1"}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Free admission only
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Search
            </button>
          </div>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {hasFilters && (
              <>
                <span className="text-slate-500">Filters active</span>
                <Link
                  href="/card-shows"
                  className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
                >
                  Clear
                </Link>
              </>
            )}
          </div>
          <NearMeButton isActive={isNearMe} radiusMiles={radiusMiles} />
        </div>
      </section>

      <aside className="mt-10 rounded-3xl border border-brand-200 bg-brand-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Help keep the card show database complete</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Know about a show we missed? Add it to the directory—no account required.</p>
        </div>
        <Link href="/submit-show" className="mt-4 inline-flex shrink-0 items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 sm:mt-0">
          Submit a show
        </Link>
      </aside>

      {!hasFilters && <StateDirectory states={US_STATES} />}

      {isNearMe ? (
        <NearbyShowResults radiusMiles={radiusMiles} view={view} />
      ) : (
      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">
              {`${total.toLocaleString()} upcoming show${total === 1 ? "" : "s"}`}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 sm:mt-2">
              <p className="text-xs text-slate-500 sm:text-sm">
                {stateName ? `Results for ${stateName}.` : "Card Show Nation directory."}
              </p>
            </div>
          </div>
          <ViewToggle current={view} />
        </div>

        {shows.length === 0 ? (
          <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-semibold text-slate-900">
              No shows match those filters.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Try broadening the search, removing a category, or browsing a state page.
            </p>
          </div>
        ) : view === "list" ? (
          <div className="mt-6 flex flex-col gap-2">
            {shows.map((show) => (
              <ShowListItem key={show.id} show={show} />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shows.map((show) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        )}
      </section>
      )}

      {!isNearMe && totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          {page > 1 && (
            <Link
              href={`/card-shows?${buildQuery(sp, { page: String(page - 1) })}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Previous
            </Link>
          )}

          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>

          {page < totalPages && (
            <Link
              href={`/card-shows?${buildQuery(sp, { page: String(page + 1) })}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
    </>
  );
}
