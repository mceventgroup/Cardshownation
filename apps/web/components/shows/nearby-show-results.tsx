"use client";

import { useEffect, useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { ShowCard } from "@/components/shows/show-card";
import { ShowListItem } from "@/components/shows/show-list-item";
import { ViewToggle } from "@/components/shows/view-toggle";
import {
  NEARBY_LOCATION_MAX_AGE_MS,
  NEARBY_LOCATION_STORAGE_KEY,
  parseStoredNearbyLocation,
  type StoredNearbyLocation,
} from "@/lib/nearby-location";
import type { ShowCard as ShowCardData } from "@/types";

type SerializedShowCard = Omit<ShowCardData, "startDate" | "endDate"> & {
  startDate: string;
  endDate: string;
};

export function NearbyShowResults({
  radiusMiles,
  view,
}: {
  radiusMiles: number;
  view: "grid" | "list";
}) {
  const [location, setLocation] = useState<StoredNearbyLocation | null>(null);
  const [shows, setShows] = useState<ShowCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stored: StoredNearbyLocation | null = null;
    try {
      stored = parseStoredNearbyLocation(
        window.sessionStorage.getItem(NEARBY_LOCATION_STORAGE_KEY),
      );
    } catch {
      setError("Your browser blocked temporary location use. Choose your state instead.");
      setLoading(false);
      return;
    }

    if (!stored) {
      try {
        window.sessionStorage.removeItem(NEARBY_LOCATION_STORAGE_KEY);
      } catch {
        // Nothing else to clear when temporary browser storage is unavailable.
      }
      setError("Your temporary location expired. Select “Use my location” to try again.");
      setLoading(false);
      return;
    }

    setLocation(stored);
    const remaining = Math.max(0, stored.createdAt + NEARBY_LOCATION_MAX_AGE_MS - Date.now());
    window.setTimeout(() => {
      try {
        const current = parseStoredNearbyLocation(
          window.sessionStorage.getItem(NEARBY_LOCATION_STORAGE_KEY),
        );
        if (!current || current.createdAt === stored.createdAt) {
          window.sessionStorage.removeItem(NEARBY_LOCATION_STORAGE_KEY);
          setLocation(null);
          setShows([]);
          setError("Your temporary location expired. Select “Use my location” to search again.");
          setLoading(false);
        }
      } catch {
        setLocation(null);
        setShows([]);
        setError("Temporary location storage is unavailable. Choose your state instead.");
        setLoading(false);
      }
    }, remaining);
  }, []);

  useEffect(() => {
    if (!location) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetch("/api/shows/nearby", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: location.lat, lng: location.lng, radius: radiusMiles }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Nearby search failed.");
        return response.json() as Promise<{ shows?: SerializedShowCard[] }>;
      })
      .then((result) => {
        setShows(
          (result.shows ?? []).map((show) => ({
            ...show,
            startDate: new Date(show.startDate),
            endDate: new Date(show.endDate),
          })),
        );
        setLoading(false);
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError("Nearby shows could not be loaded. Try again or choose your state.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [location, radiusMiles]);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">
            {loading
              ? "Finding shows near you…"
              : `${shows.length} show${shows.length === 1 ? "" : "s"} within ${radiusMiles} mi`}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 sm:mt-2">
            <p className="text-xs text-slate-500 sm:text-sm">
              Your rounded device location is used only for this nearby search.
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
              <LocateFixed className="h-3 w-3" />
              Device location
            </span>
          </div>
        </div>
        <ViewToggle current={view} />
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-[2rem] border border-slate-200 bg-white p-10 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading nearby shows
        </div>
      ) : error ? (
        <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">{error}</p>
        </div>
      ) : shows.length === 0 ? (
        <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">No shows found within {radiusMiles} miles.</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Try a larger radius or browse shows by state.</p>
        </div>
      ) : view === "list" ? (
        <div className="mt-6 flex flex-col gap-2">
          {shows.map((show) => <ShowListItem key={show.id} show={show} />)}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shows.map((show) => <ShowCard key={show.id} show={show} />)}
        </div>
      )}
    </section>
  );
}
