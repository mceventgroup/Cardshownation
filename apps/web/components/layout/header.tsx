import Link from "next/link";
import { MapPin, Plus, Search } from "lucide-react";
import { getDataModeLabel, isFixtureMode } from "@/lib/data-mode";
import { getPublicPortalLink } from "@/lib/public-portal";

export async function Header() {
  const portalLink = await getPublicPortalLink();
  const showGuestCta = portalLink.href === "/login";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-wide py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-2xl">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold leading-tight text-slate-950 sm:text-base sm:leading-none">
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

          <Link
            href="/submit-show"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 sm:hidden"
          >
            <Plus className="h-4 w-4" />
            Submit show
          </Link>

          <nav className="hidden items-center justify-end gap-2 sm:flex lg:gap-3">
            <Link
              href="/card-shows"
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              <Search className="h-4 w-4" />
              Browse Shows
            </Link>
            <Link
              href="/floorplanner"
              className="inline-flex items-center justify-center rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              Floor Planner
            </Link>
            <Link
              href={portalLink.href}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
            >
              {portalLink.label}
            </Link>
            {showGuestCta && (
              <Link
                href="/account/signup"
                className="hidden items-center justify-center rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-100 lg:inline-flex"
              >
                Create Account
              </Link>
            )}
            <Link
              href="/submit-show"
              className="inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Submit a Show
            </Link>
          </nav>
        </div>
        <nav className="mt-2 flex items-center justify-center gap-1 border-t border-slate-100 pt-2 sm:hidden" aria-label="Main navigation">
          <Link href="/card-shows" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            <Search className="h-3.5 w-3.5" /> Browse
          </Link>
          <Link href="/floorplanner" className="inline-flex flex-1 items-center justify-center rounded-full px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            Planner
          </Link>
          <Link href={portalLink.href} className="inline-flex flex-1 items-center justify-center rounded-full px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            {portalLink.shortLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
