import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { AdSlot } from "@/components/ads/ad-slot";
import { NearMeButton } from "@/components/shows/near-me-button";
import { ShowListItem } from "@/components/shows/show-list-item";
import { getPublicPortalLink } from "@/lib/public-portal";
import { isPurchasingEnabled } from "@/lib/purchasing";
import { getHomepageDirectoryStats, getUpcomingShows } from "@/lib/shows";
import { US_STATES } from "@/lib/states";
import { serializeJsonLd } from "@/lib/safe-json-ld";
import { absoluteSiteUrl } from "@/lib/site-url";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Card Show Nation | Find Upcoming Card Shows",
  description:
    "The national card show directory. Find upcoming sports card, Pokemon, and TCG shows by state, city, and date.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Card Show Nation | Find Upcoming Card Shows",
    description: "Find upcoming sports card, Pokemon, and TCG shows by state, city, and date.",
    url: absoluteSiteUrl(),
  },
};

const HOME_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_AD_SLOT_HOME_INLINE?.trim() ?? "";

export default async function HomePage() {
  const floorPlannerAvailable = isPurchasingEnabled();
  const [portalLink, upcomingShows, stats] = await Promise.all([
    getPublicPortalLink(),
    getUpcomingShows({ limit: 8 }).catch((err) => {
      console.error("[HomePage] getUpcomingShows failed, rendering empty list:", err);
      return { shows: [], total: 0 };
    }),
    getHomepageDirectoryStats().catch((err) => {
      console.error("[HomePage] getHomepageDirectoryStats failed, rendering zeros:", err);
      return { upcomingShows: 0, activeStates: 0, activeOrganizers: 0 };
    }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${absoluteSiteUrl()}/#website`,
        name: "Card Show Nation",
        url: absoluteSiteUrl(),
        publisher: { "@id": `${absoluteSiteUrl()}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${absoluteSiteUrl()}/#organization`,
        name: "Card Show Nation",
        url: absoluteSiteUrl(),
        logo: absoluteSiteUrl("/csn-brand-mark.png"),
        description: "A free national directory for sports card, Pokemon, and trading card shows.",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative flex min-h-[80vh] items-center overflow-hidden bg-slate-950 text-white">
        {/* Background image — priority-loaded above-the-fold, blurred and scaled so edges don't clip */}
        <Image
          src="/cardshow_hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 scale-[1.02] object-cover blur-[2px]"
        />
        {/* Dark overlay sits between image and content */}
        <div aria-hidden className="absolute inset-0 bg-black/65" />

        <div className="container-wide relative z-10 py-16 sm:py-20">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white drop-shadow-md sm:text-5xl">
            Find card shows near you.
          </h1>
          <p className="mt-3 max-w-xl text-base text-slate-200 drop-shadow">
            Search by city, show name, or promoter — or use your location.
          </p>

          <form
            action="/card-shows"
            method="GET"
            className="mt-7 flex max-w-xl gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                name="q"
                placeholder="City, state, or show name"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-500 shadow-lg focus:border-brand-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="whitespace-nowrap rounded-2xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-400"
            >
              Search
            </button>
          </form>

          <div className="mt-4">
            <NearMeButton
              isActive={false}
              label="Use my location"
              tone="dark"
              align="start"
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/submit-show"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-400"
            >
              Submit a show
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={portalLink.href}
              className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-white/15"
            >
              {portalLink.label}
            </Link>
          </div>

          <div className="mt-10 grid max-w-xl gap-6 text-slate-200 sm:grid-cols-3">
            <div>
              <p className="text-2xl font-semibold text-white drop-shadow">
                {stats.upcomingShows.toLocaleString()}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                Upcoming shows
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white drop-shadow">{stats.activeStates}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                States
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white drop-shadow">{stats.activeOrganizers}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                Promoters
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming shows */}
      <section className="container-wide py-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">Upcoming shows</h2>
          <Link
            href="/card-shows"
            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {upcomingShows.shows.map((show) => (
            <ShowListItem key={show.id} show={show} />
          ))}
        </div>
      </section>

      {HOME_INLINE_AD_SLOT && (
        <section className="container-wide pb-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sponsored
            </p>
            <AdSlot slot={HOME_INLINE_AD_SLOT} format="horizontal" className="min-h-[90px]" />
          </div>
        </section>
      )}

      {/* Floor Planner */}
      <section className="container-wide pb-10">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-xl shadow-slate-200/60">
          <div className="grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-10 lg:p-10">
            <div className="text-white">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ring-1 ${
                  floorPlannerAvailable
                    ? "bg-emerald-400/10 text-emerald-300 ring-emerald-300/30"
                    : "bg-amber-400/10 text-amber-200 ring-amber-300/30"
                }`}
              >
                {floorPlannerAvailable ? "Available now" : "Coming soon"}
              </span>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Floor Planner
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                See your show before the doors open.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Build room layouts, place and number tables, assign vendors, and export a
                clear plan for setup and show day.
              </p>
              <Link
                href="/floorplanner"
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
              >
                Explore Floor Planner
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <Link
              href="/floorplanner"
              aria-label="See the Card Show Nation Floor Planner"
              className="group relative block overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl"
            >
              <Image
                src="/floor-planner-preview.png"
                alt="Card Show Nation Floor Planner showing a room layout with rows of vendor tables"
                width={1265}
                height={650}
                sizes="(min-width: 1024px) 57vw, 100vw"
                className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.015]"
              />
              <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
                View Floor Planner
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* State directory */}
      <section className="container-wide pb-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">Browse by state</h2>
          <Link
            href="/card-shows"
            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            Full directory
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {US_STATES.map((state) => (
            <Link
              key={state.code}
              href={`/card-shows/${state.slug}`}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-medium text-slate-800 transition-all hover:border-brand-200 hover:bg-brand-50"
            >
              {state.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Promoter CTA */}
      <section className="container-wide pb-12">
        <div className="rounded-[2rem] bg-slate-950 px-6 py-8 text-white flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">Organizing a show?</p>
            <p className="mt-1 text-sm text-slate-400">Free to list. Goes live after a quick review.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/submit-show"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100 shrink-0"
            >
              Submit a show
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={portalLink.href}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 shrink-0"
            >
              {portalLink.label}
            </Link>
            <Link
              href="/account/signup?promoter=1"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 shrink-0"
            >
              Create promoter account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
