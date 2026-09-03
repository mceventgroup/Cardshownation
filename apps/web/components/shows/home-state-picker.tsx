"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { DirectoryState } from "@/lib/states";

type HomeStatePickerProps = {
  states: DirectoryState[];
};

export function HomeStatePicker({ states }: HomeStatePickerProps) {
  const router = useRouter();

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <label htmlFor="home-state-picker" className="block text-sm font-semibold text-slate-900">
        Choose your state
      </label>
      <div className="mt-2">
        <div className="relative w-full sm:max-w-md">
          <select
            id="home-state-picker"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) router.push(`/card-shows/${event.target.value}`);
            }}
            className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-11 text-base font-medium text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Select a state…</option>
            {states.map((state) => (
              <option key={state.code} value={state.slug}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Open the menu or type the first letters of your state. You’ll go straight to its show page.
      </p>
    </div>
  );
}
