"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LayoutGrid, List } from "lucide-react";
import type { DirectoryState } from "@/lib/states";

export function StateDirectory({ states }: { states: DirectoryState[] }) {
  const [view, setView] = useState<"bubble" | "list">("list");

  return (
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Jump to a state page</h2>
          <p className="mt-1 text-sm text-slate-500">States are listed A–Z down each column.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setView("bubble")}
              aria-label="Show states in a compact grid"
              aria-pressed={view === "bubble"}
              className={`rounded-lg p-1.5 transition-colors ${
                view === "bubble" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Bubble view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="Show states in alphabetical columns"
              aria-pressed={view === "list"}
              className={`rounded-lg p-1.5 transition-colors ${
                view === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600"
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Link
            href="/submit-show"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            Submit a show
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {view === "bubble" ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {states.map((state) => (
            <Link
              key={state.code}
              href={`/card-shows/${state.slug}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 sm:px-4 sm:py-3 sm:text-sm"
            >
              {state.name}
            </Link>
          ))}
        </div>
      ) : (
        <nav aria-label="State directory" className="mt-4 columns-2 gap-3 sm:columns-3 lg:columns-4">
          {states.map((state) => (
            <Link
              key={state.code}
              href={`/card-shows/${state.slug}`}
              className="flex break-inside-avoid items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <span>{state.name}</span>
              <span className="text-xs font-mono text-slate-400">{state.code}</span>
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
