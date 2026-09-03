"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LocateFixed, X } from "lucide-react";
import { DEFAULT_NEARBY_RADIUS, NEARBY_RADIUS_OPTIONS, normalizeNearbyRadius } from "@/lib/nearby-radius";
import { NEARBY_LOCATION_STORAGE_KEY } from "@/lib/nearby-location";
import { cn } from "@/lib/utils";

type NearMeButtonProps = {
  isActive: boolean;
  radiusMiles?: number;
  align?: "start" | "end";
  label?: string;
  tone?: "light" | "dark";
};

function buildNearbyHref({
  radiusMiles,
  view,
}: {
  radiusMiles: number;
  view?: string | null;
}) {
  const params = new URLSearchParams();

  params.set("nearby", "1");
  params.set("radius", String(radiusMiles));

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
  const [selectedRadiusMiles, setSelectedRadiusMiles] = useState(() =>
    normalizeNearbyRadius(radiusMiles),
  );

  function handleClick() {
    if (isActive) {
      try {
        window.sessionStorage.removeItem(NEARBY_LOCATION_STORAGE_KEY);
      } catch {
        // The location will still expire automatically if storage access is blocked.
      }
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
        try {
          window.sessionStorage.setItem(
            NEARBY_LOCATION_STORAGE_KEY,
            JSON.stringify({
              lat: Math.round(coords.latitude * 100) / 100,
              lng: Math.round(coords.longitude * 100) / 100,
              createdAt: Date.now(),
            }),
          );
        } catch {
          setError("Your browser blocked temporary location use. Choose your state instead.");
          setLoading(false);
          return;
        }

        router.push(buildNearbyHref({ radiusMiles: selectedRadiusMiles, view }));
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
          Uses device GPS, rounds it before sending, and keeps it only in this tab for up to 15 minutes.
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
            setSelectedRadiusMiles(nextRadius);

            if (!isActive) {
              return;
            }

            const params = new URLSearchParams(searchParams.toString());
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
