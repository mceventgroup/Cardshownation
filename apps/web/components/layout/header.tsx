import Link from "next/link";
import { ExternalLink, Home, LayoutDashboard, Map, Plus, Search, UserRound } from "lucide-react";
import { getDataModeLabel, isFixtureMode } from "@/lib/data-mode";
import { getPublicPortalLink } from "@/lib/public-portal";
import { MobileMenu } from "@/components/layout/mobile-menu";

export async function Header() {
  const portalLink = await getPublicPortalLink();
  const showGuestCta = portalLink.href === "/login";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-wide py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="whitespace-nowrap text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
              Card Show Nation
            </span>
            {isFixtureMode() && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                {getDataModeLabel()}
              </span>
            )}
          </Link>

          <div className="shrink-0 sm:hidden">
            <MobileMenu>
              <nav aria-label="Main navigation" className="space-y-1">
                <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  <Home className="h-4 w-4" aria-hidden="true" />
                  Main website
                </Link>
                <Link href="/card-shows" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Browse Shows
                </Link>
                <Link href="/floorplanner" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  <Map className="h-4 w-4" aria-hidden="true" />
                  Floor Planner
                </Link>
                <a href="https://kansascardshow.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Kansas Card Show
                </a>
                <Link href={portalLink.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                  {portalLink.href === "/account" ? (
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  )}
                  {portalLink.label}
                </Link>
                {showGuestCta && (
                  <Link href="/account/signup" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-800 hover:bg-brand-50">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    Create Account
                  </Link>
                )}
                <Link href="/submit-show" className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Submit a Show
                </Link>
              </nav>
            </MobileMenu>
          </div>

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
            <a
              href="https://kansascardshow.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 hover:text-brand-800 xl:inline-flex"
            >
              Kansas Card Show
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
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
      </div>
    </header>
  );
}
