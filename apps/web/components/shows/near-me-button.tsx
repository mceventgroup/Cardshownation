"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LocateFixed, MapPin, X } from "lucide-react";
import { DEFAULT_NEARBY_RADIUS, NEARBY_RADIUS_OPTIONS, normalizeNearbyRadius } from "@/lib/nearby-radius";
import { cn } from "@/lib/utils";

type GeoipLocation = {
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
};

type NearMeButtonProps = {
  isActive: boolean;
  approximateResultsShown?: boolean;
  radiusMiles?: number;
  align?: "start" | "end";
  label?: string;
  tone?: "light" | "dark";
};

function toFiniteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseGeoipLocation(value: unknown): GeoipLocation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const lat = toFiniteNumber(candidate.lat);
  const lng = toFiniteNumber(candidate.lng);

  if (lat === null || lng === null) {
    return null;
  }

  return {
    lat,
    lng,
    city: typeof candidate.city === "string" ? candidate.city : null,
    region: typeof candidate.region === "string" ? candidate.region : null,
  };
}

async function fetchIpLocation(signal?: AbortSignal): Promise<GeoipLocation | null> {
  const response = await fetch("/api/geoip", {
    headers: { accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    return null;
  }

  return parseGeoipLocation(await response.json());
}

function formatLocationLabel(location: GeoipLocation | null) {
  if (!location) {
    return null;
  }

  return [location.city, location.region].filter(Boolean).join(", ") || null;
}

function buildNearbyHref({
  lat,
  lng,
  near,
  radiusMiles,
  source,
  view,
}: {
  lat: number;
  lng: number;
  near?: string | null;
  radiusMiles: number;
  source: "gps" | "ip";
  view?: string | null;
}) {
  const params = new URLSearchParams();

  params.set("lat", lat.toFixed(5));
  params.set("lng", lng.toFixed(5));
  params.set("radius", String(radiusMiles));
  params.set("source", source);

  if (near) {
    params.set("near", near);
  }

  if (view === "grid") {
    params.set("view", "grid");
  }

  return `/card-shows?${params.toString()}`;
}

export function NearMeButton({
  isActive,
  approximateResultsShown = false,
  align = "end",
  label = "Near me",
  radiusMiles = DEFAULT_NEARBY_RADIUS,
  tone = "light",
}: NearMeButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ipLocation, setIpLocation] = useState<GeoipLocation | null>(null);

  const locationLabel = formatLocationLabel(ipLocation);
  const view = searchParams.get("view");
  const helperTone =
    tone === "dark" ? "text-slate-400" : "text-slate-500";
  const errorTone =
    tone === "dark" ? "text-rose-300" : "text-red-500";
  const selectedRadiusMiles = normalizeNearbyRadius(radiusMiles);

  useEffect(() => {
    if (isActive || ipLocation) {
      return;
    }

    const controller = new AbortController();

    void fetchIpLocation(controller.signal)
      .then((location) => {
        if (location) {
          setIpLocation(location);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      });

    return () => controller.abort();
  }, [ipLocation, isActive]);

  async function navigateWithIp() {
    try {
      const location = ipLocation ?? (await fetchIpLocation());

      if (!location) {
        setError("Could not determine your location. Search by city or state instead.");
        setLoading(false);
        return;
      }

      setIpLocation(location);
      router.push(
        buildNearbyHref({
          lat: location.lat,
          lng: location.lng,
          near: formatLocationLabel(location),
          radiusMiles,
          source: "ip",
          view,
        })
      );
    } catch {
      setError("Could not determine your location. Search by city or state instead.");
      setLoading(false);
    }
  }

  function handleClick() {
    if (isActive) {
      router.push(view === "grid" ? "/card-shows?view=grid" : "/card-shows");
      return;
    }

    setLoading(true);
    setError(null);

    if (!navigator?.geolocation) {
      void navigateWithIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        router.push(
          buildNearbyHref({
            lat: coords.latitude,
            lng: coords.longitude,
            radiusMiles,
            source: "gps",
            view,
          })
        );
        setLoading(false);
      },
      () => void navigateWithIp(),
      { timeout: 8000 }
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        align === "start" ? "items-start" : "items-end"
      )}
    >
      <button
        type="button"
        data-analytics-event={isActive ? "clear_near_me" : "use_near_me"}
        data-analytics-source={tone === "dark" ? "homepage" : "show_directory"}
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60",
          tone === "dark"
            ? isActive
              ? "border-brand-400/60 bg-brand-500 text-white hover:bg-brand-400"
              : "border-white/15 bg-white/5 text-white hover:border-brand-300/50 hover:bg-white/10"
            : isActive
              ? "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
              : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <X className="h-4 w-4" />
        ) : (
          <LocateFixed className="h-4 w-4" />
        )}
        {isActive ? "Clear near me" : label}
      </button>
      {!isActive && (
        <p className={cn("max-w-xs text-xs", helperTone)}>
          {approximateResultsShown && locationLabel ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Showing approximate results near {locationLabel}. Use GPS to refine them.
            </span>
          ) : approximateResultsShown ? (
            "Showing results for your approximate area. Use GPS to refine them."
          ) : locationLabel ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Falls back to approximate results near {locationLabel} if GPS is unavailable.
            </span>
          ) : (
            "Uses GPS first. Falls back to an approximate network location if needed."
          )}
        </p>
      )}
      {error && <p className={cn("max-w-xs text-xs", errorTone)}>{error}</p>}
      <label className={cn("flex items-center gap-2 text-xs font-medium", helperTone)}>
        <span>Distance</span>
        <select
          value={String(selectedRadiusMiles)}
          disabled={loading}
          onChange={(event) => {
            const nextRadius = normalizeNearbyRadius(event.target.value);
            const params = new URLSearchParams(searchParams.toString());

            if (!isActive) {
              params.set("radius", String(nextRadius));
              router.replace(`/card-shows?${params.toString()}`);
              return;
            }

            params.set("radius", String(nextRadius));
            router.push(`/card-shows?${params.toString()}`);
          }}
          className={cn(
            "rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors focus:outline-none",
            tone === "dark"
              ? "border-white/15 bg-white/5 text-white focus:border-brand-300"
              : "border-slate-200 focus:border-brand-400"
          )}
        >
          {NEARBY_RADIUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} mi
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
