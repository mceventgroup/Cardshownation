import Link from "next/link";
import { MapPin } from "lucide-react";
import { HOMEPAGE_STATE_CODES, getStatesByCodes } from "@/lib/states";

const featuredStates = getStatesByCodes(HOMEPAGE_STATE_CODES);

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-wide py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-950">
                  Card Show Nation
                </p>
                <p className="text-sm text-slate-500">
                  Discovery first. Organizer tools next.
                </p>
              </div>
            </Link>

            <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
              Card Show Nation helps collectors find upcoming sports card,
              Pokemon, and TCG shows by state, city, and date while giving
              promoters a clean path to get listed.
            </p>
          </div>

          <nav aria-label="Explore Card Show Nation">
            <h2 className="text-sm font-semibold text-slate-950">Explore</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
              <Link href="/card-shows" className="transition-colors hover:text-brand-700">
                Browse all shows
              </Link>
              <Link href="/submit-show" className="transition-colors hover:text-brand-700">
                Submit a show
              </Link>
              <Link href="/card-shows/kansas" className="transition-colors hover:text-brand-700">
                Kansas card shows
              </Link>
              <Link href="/card-shows/missouri" className="transition-colors hover:text-brand-700">
                Missouri card shows
              </Link>
            </div>
          </nav>

          <nav aria-label="Browse shows by state">
            <h2 className="text-sm font-semibold text-slate-950">Browse by State</h2>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600">
              {featuredStates.map((state) => (
                <Link
                  key={state.code}
                  href={`/card-shows/${state.slug}`}
                  className="transition-colors hover:text-brand-700"
                >
                  {state.name}
                </Link>
              ))}
            </div>
          </nav>

          <nav aria-label="Legal information">
            <h2 className="text-sm font-semibold text-slate-950">Legal &amp; Support</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
              <Link href="/legal" className="transition-colors hover:text-brand-700">Legal Center</Link>
              <Link href="/privacy" className="transition-colors hover:text-brand-700">Privacy Policy</Link>
              <Link href="/terms" className="transition-colors hover:text-brand-700">Terms of Use</Link>
              <Link href="/cookies" className="transition-colors hover:text-brand-700">Cookie Policy</Link>
              <Link href="/cookies#choices" className="transition-colors hover:text-brand-700">Your Privacy Choices</Link>
              <Link href="/billing-terms" className="transition-colors hover:text-brand-700">Billing Terms</Link>
              <Link href="/accessibility" className="transition-colors hover:text-brand-700">Accessibility</Link>
              <Link href="/contact" className="transition-colors hover:text-brand-700">Contact &amp; Support</Link>
            </div>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Card Show Nation. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/submit-show" className="transition-colors hover:text-slate-800">
              Submit a show
            </Link>
            <Link href="/legal" className="transition-colors hover:text-slate-800">Legal</Link>
            <Link href="/accessibility" className="transition-colors hover:text-slate-800">Accessibility</Link>
            <Link href="/contact" className="transition-colors hover:text-slate-800">Contact</Link>
            <Link href="/admin" className="transition-colors hover:text-slate-800">
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
