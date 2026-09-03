"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LocateFixed, X } from "lucide-react";
import { DEFAULT_NEARBY_RADIUS, NEARBY_RADIUS_OPTIONS, normalizeNearbyRadius } from "@/lib/nearby-radius";
import { cn } from "@/lib/utils";

type NearMeButtonProps = {
  isActive: boolean;
  radiusMiles?: number;
  align?: "start" | "end";
  label?: string;
  tone?: "light" | "dark";
};

function buildNearbyHref({
  lat,
  lng,
  radiusMiles,
  source,
  view,
}: {
  lat: number;
  lng: number;
  radiusMiles: number;
  source: "gps";
  view?: string | null;
}) {
  const params = new URLSearchParams();

  params.set("lat", lat.toFixed(5));
  params.set("lng", lng.toFixed(5));
  params.set("radius", String(radiusMiles));
  params.set("source", source);

  if (view === "grid") {
    params.set("view", "grid");
  }

  return `/card-shows?${params.toString()}`;
}

export function NearMeButton({
  isActive,
  align = "end",
  label = "Near me",
  radiusMiles = DEFAULT_NEARBY_RADIUS,
  tone = "light",
}: NearMeButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = searchParams.get("view");
  const helperTone =
    tone === "dark" ? "text-slate-400" : "text-slate-500";
  const errorTone =
    tone === "dark" ? "text-rose-300" : "text-red-500";
  const selectedRadiusMiles = normalizeNearbyRadius(radiusMiles);

  function handleClick() {
    if (isActive) {
      router.push(view === "grid" ? "/card-shows?view=grid" : "/card-shows");
      return;
    }

    setLoading(true);
    setError(null);

    if (!navigator?.geolocation) {
      setError("Precise location is not supported on this device. Choose your state instead.");
      setLoading(false);
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
      (positionError) => {
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Location access was denied. Allow location access or choose your state instead."
            : positionError.code === positionError.TIMEOUT
              ? "Precise location timed out. Try again or choose your state instead."
              : "Precise location is unavailable. Try again or choose your state instead."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 300_000, timeout: 12_000 }
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
          Uses precise device GPS, not your internet provider’s location. Your browser may ask permission.
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
