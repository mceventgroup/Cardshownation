"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { DirectoryState } from "@/lib/states";

type HomeStatePickerProps = {
  states: DirectoryState[];
  preferredState?: DirectoryState | null;
  savedToAccount?: boolean;
};

export function HomeStatePicker({
  states,
  preferredState,
  savedToAccount = false,
}: HomeStatePickerProps) {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState(preferredState?.code ?? "");
  const [saving, setSaving] = useState(false);

  async function openState(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = states.find((state) => state.code === selectedCode);
    if (!selected) return;

    setSaving(true);
    try {
      await fetch("/api/preferences/state", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: selected.code }),
      });
    } finally {
      router.push(`/card-shows/${selected.slug}`);
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <form onSubmit={openState}>
        <label htmlFor="home-state-picker" className="block text-sm font-semibold text-slate-900">
          Choose your state
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative w-full sm:max-w-md">
          <select
            id="home-state-picker"
            value={selectedCode}
            onChange={(event) => setSelectedCode(event.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-11 text-base font-medium text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Select a state…</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          />
          </div>
          <button
            type="submit"
            disabled={!selectedCode || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Opening…" : "View shows"}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </form>
      <p className="mt-2 text-xs text-slate-500">
        {preferredState
          ? `${preferredState.name} was remembered ${savedToAccount ? "from your account" : "on this device"}.`
          : "Your selection is remembered for six months. Signed-in members also save it to their account."}
      </p>
    </div>
  );
}
