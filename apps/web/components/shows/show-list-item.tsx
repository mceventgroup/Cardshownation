import Link from "next/link";
import { ArrowRight, MapPin, Clock } from "lucide-react";
import { formatShowDate } from "@/lib/utils";
import type { ShowCard } from "@/types";

export function ShowListItem({ show }: { show: ShowCard }) {
  return (
    <Link
      href={`/shows/${show.slug}`}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-all hover:border-brand-200 hover:shadow-sm sm:gap-4"
    >
      {/* Date badge */}
      <div className="w-12 shrink-0 text-center sm:w-14">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700 sm:text-[11px]">
          {new Date(show.startDate).toLocaleString("en-US", { month: "short", timeZone: "UTC" })}
        </p>
        <p className="text-base font-bold leading-none text-slate-950 sm:text-lg">
          {new Date(show.startDate).getUTCDate()}
        </p>
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-slate-900 transition-colors group-hover:text-brand-700">
            {show.title}
          </p>
          {show.isFree && (
            <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
              Free
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
          <time dateTime={new Date(show.startDate).toISOString().slice(0, 10)}>
            {formatShowDate(show.startDate, show.endDate)}
          </time>
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 sm:text-sm">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
            <span className="truncate">
              {show.city}, {show.state}
              {show.venue ? ` · ${show.venue.name}` : ""}
            </span>
          </span>
          {show.distanceMiles !== undefined && (
            <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
              {show.distanceMiles} mi
            </span>
          )}
          {show.startTimeLabel && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
              {show.startTimeLabel}
              {show.endTimeLabel ? ` – ${show.endTimeLabel}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Categories — tablet+ */}
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {show.categories.slice(0, 2).map((c) => (
          <span
            key={c}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
          >
            {c}
          </span>
        ))}
      </div>

      {/* Admission — desktop */}
      <div className="hidden shrink-0 text-right text-sm lg:block">
        {!show.isFree && (
          <span className="text-slate-500">{show.admissionPrice ?? "—"}</span>
        )}
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
    </Link>
  );
}
