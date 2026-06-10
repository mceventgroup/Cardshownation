import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Grid3X3, Ruler, Store } from "lucide-react";

export const metadata: Metadata = {
  title: "Floorplanner",
  description:
    "Card Show Nation Floorplanner helps teams design vendor-ready floor plans for card shows with a purpose-built layout workflow.",
};

const featureCards = [
  {
    title: "Design around real show flow",
    body: "Lay out aisles, tables, and vendor zones in a workspace built for event operations instead of generic drawing tools.",
    icon: Grid3X3,
  },
  {
    title: "Plan booth density faster",
    body: "Pressure-test table counts, circulation, and placement decisions before the floor opens to vendors and attendees.",
    icon: Ruler,
  },
  {
    title: "Built for card show operations",
    body: "Use a floor planning workflow tied directly to Card Show Nation's show management stack and event records.",
    icon: Store,
  },
];

export default function FloorplannerLandingPage() {
  return (
    <div className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="container-wide py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
              Card Show Nation Tool
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Floorplanner for card shows.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              A dedicated floor planning app for designing vendor layouts, table maps,
              and event-ready show floors inside the Card Show Nation ecosystem.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/submit-show"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Get your show listed
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/card-shows"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
            >
              Browse live shows
            </Link>
          </div>
        </div>
      </section>

      <section className="container-wide py-12">
        <div className="grid gap-4 lg:grid-cols-3">
          {featureCards.map(({ title, body, icon: Icon }) => (
            <div
              key={title}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-wide pb-14">
        <div className="rounded-[2rem] bg-slate-950 px-6 py-8 text-white sm:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold">A real product slot on the website.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
              Floorplanner now has a public-facing destination on Card Show Nation
              for product visibility and future marketing, while the working editor
              remains protected behind the existing admin workflow.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
