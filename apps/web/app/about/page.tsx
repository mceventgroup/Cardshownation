import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, SearchCheck, ShieldCheck, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "About & Editorial Policy",
  description:
    "Learn who operates Card Show Nation, where show information comes from, how listings are reviewed, and how to request a correction.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Card Show Nation & Our Editorial Policy",
    description:
      "How Card Show Nation sources, reviews, updates, and corrects card-show listings.",
    url: "/about",
  },
};

const principles = [
  {
    title: "Useful to collectors",
    description: "Dates, location, hours, admission, and official links take priority because they help someone decide whether to attend.",
    icon: SearchCheck,
  },
  {
    title: "Fair to promoters",
    description: "Promoters can submit, claim, and correct listings. We try to preserve the most complete record instead of publishing duplicates.",
    icon: Users,
  },
  {
    title: "Transparent about certainty",
    description: "A verification date records when information was reviewed or refreshed; it is not a guarantee that an event cannot change afterward.",
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  return (
    <div className="container-wide py-10 sm:py-14">
      <header className="rounded-[2rem] bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-300">About Card Show Nation</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">A clearer, more reliable way to find card shows.</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
          Card Show Nation is a national directory operated by MC Event Group LLC, the team behind Kansas Card Show. We help collectors discover events and give promoters a straightforward way to publish and maintain accurate listings.
        </p>
      </header>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {principles.map(({ title, description, icon: Icon }) => (
          <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <Icon className="h-6 w-6 text-brand-700" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </article>
        ))}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article id="editorial-policy" className="scroll-mt-28 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Editorial policy</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">How listings are sourced and verified</h2>

          <div className="mt-7 space-y-8 text-sm leading-7 text-slate-600 sm:text-base">
            <section>
              <h3 className="font-semibold text-slate-950">Where information comes from</h3>
              <p className="mt-2">Listings may be submitted by promoters or community members, entered by our team, or collected from publicly available event pages and calendars.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-950">What verification means</h3>
              <p className="mt-2">We compare available dates, location, hours, admission details, organizer information, and official links. The “last verified” date shows when a listing was most recently reviewed, approved, or refreshed from its source. Events can still change without notice, so attendees should confirm important travel details with the promoter or venue.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-950">Corrections and duplicates</h3>
              <p className="mt-2">Visitors can report incorrect information directly from a show page. Promoters can claim or update a listing. When duplicate records are identified, we aim to keep the most complete listing and preserve useful relationships such as saved shows and reports.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-950">Featured listings and advertising</h3>
              <p className="mt-2">Paid placements, advertisements, and featured listings are labeled. Payment does not allow a promoter to bypass accuracy, safety, or moderation requirements, and it does not determine the factual content of a listing.</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-950">Ownership and contact</h3>
              <p className="mt-2">Card Show Nation is operated by MC Event Group LLC in Kansas. Questions about a listing or this policy can be sent to <a href="mailto:support@cardshownation.com" className="font-semibold text-brand-700 underline-offset-4 hover:underline">support@cardshownation.com</a>.</p>
            </section>
          </div>
        </article>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6">
            <CheckCircle2 className="h-6 w-6 text-brand-700" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">See something wrong?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Use “Report incorrect information” on the affected show page so the report stays attached to the right listing.</p>
            <Link href="/card-shows" className="mt-4 inline-flex font-semibold text-brand-700 hover:text-brand-800">Find the show</Link>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Run a card show?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Add one event, upload a schedule, or claim an existing listing instead of creating a duplicate.</p>
            <Link href="/submit-show" className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Submit a show</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
