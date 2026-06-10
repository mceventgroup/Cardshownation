import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { getDataModeLabel, isFixtureMode } from "@/lib/data-mode";
import { getPromoterSession } from "@/lib/promoter-auth";
import { getStatesByCodes } from "@/lib/states";

// High-traffic states shown as quick links on mobile
const quickStateLinks = getStatesByCodes(["TX", "CA", "FL", "OH", "PA", "IL"]);

export async function Header() {
  const session = await getPromoterSession();
  const promoterHref = session ? "/promoter" : "/promoter/login";
  const promoterLabel = session ? "My Dashboard" : "Promoter Login";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-wide py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold leading-none text-slate-950">
                  Card Show Nation
                </p>
                {isFixtureMode() && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    {getDataModeLabel()}
                  </span>
                )}
              </div>
              <p className="mt-1 hidden text-xs text-slate-500 sm:block">
                Card show discovery for collectors and promoters
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/floorplanner"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              <span>Floorplanner</span>
            </Link>
            <Link
              href="/card-shows"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Browse Shows</span>
              <span className="sm:hidden">Browse</span>
            </Link>
            <Link
              href={promoterHref}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
            >
              <span className="hidden sm:inline">{promoterLabel}</span>
              <span className="sm:hidden">{session ? "Dashboard" : "Login"}</span>
            </Link>
            <Link
              href="/submit-show"
              className="inline-flex items-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Submit a Show
            </Link>
          </nav>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
          <Link
            href="/floorplanner"
            className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
          >
            Floorplanner
          </Link>
          {quickStateLinks.map((state) => (
            <Link
              key={state.code}
              href={`/card-shows/${state.slug}`}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              {state.name}
            </Link>
          ))}
          <Link
            href={promoterHref}
            className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
          >
            {promoterLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
