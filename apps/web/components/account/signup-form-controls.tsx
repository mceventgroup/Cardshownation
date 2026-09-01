"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Search } from "lucide-react";
import type { DirectoryState } from "@/lib/states";

export function PromoterOptInFields({
  defaultChecked = false,
  disabled,
}: {
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const [isPromoter, setIsPromoter] = useState(defaultChecked);

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-3xl border border-brand-200 bg-brand-50 p-5 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isPromoter"
          checked={isPromoter}
          disabled={disabled}
          onChange={(event) => setIsPromoter(event.target.checked)}
          className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>
          <span className="block font-semibold text-slate-950">I organize card shows</span>
          <span className="mt-1 block leading-6">
            Add promoter tools to this account. You will still have all collector features.
          </span>
        </span>
      </label>

      {isPromoter && (
        <section
          aria-labelledby="promoter-profile-heading"
          className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
        >
          <h2 id="promoter-profile-heading" className="font-semibold text-slate-900">
            Promoter profile details
          </h2>
          <div className="mt-5 space-y-5">
            <div>
              <label
                htmlFor="organizerName"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Organizer or business name
              </label>
              <input
                id="organizerName"
                name="organizerName"
                type="text"
                required
                disabled={disabled}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <input
                aria-label="Website"
                name="websiteUrl"
                type="url"
                placeholder="Website"
                disabled={disabled}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-base"
              />
              <input
                aria-label="Facebook"
                name="facebookUrl"
                type="url"
                placeholder="Facebook"
                disabled={disabled}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-base"
              />
              <input
                aria-label="Instagram"
                name="instagramUrl"
                type="url"
                placeholder="Instagram"
                disabled={disabled}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-base"
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

type PasswordFieldProps = {
  disabled?: boolean;
  id: string;
  label: string;
  maxLength: number;
  minLength: number;
  name: string;
};

export function PasswordField({
  disabled,
  id,
  label,
  maxLength,
  minLength,
  name,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const buttonLabel = visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          maxLength={maxLength}
          disabled={disabled}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-base text-slate-900 focus:border-brand-400 focus:outline-none"
        />
        <button
          type="button"
          aria-label={buttonLabel}
          title={buttonLabel}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-1.5 right-1.5 inline-flex w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function StateMultiSelect({
  defaultSelectedCodes = [],
  disabled,
  states,
}: {
  defaultSelectedCodes?: string[];
  disabled?: boolean;
  states: DirectoryState[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set(defaultSelectedCodes),
  );

  const filteredStates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return states;

    return states.filter((state) =>
      `${state.name} ${state.code}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query, states]);

  const selectedLabels = useMemo(
    () => states.filter((state) => selectedCodes.has(state.code)).map((state) => state.name),
    [selectedCodes, states],
  );

  function toggleState(code: string) {
    setSelectedCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block font-medium text-slate-900">
            {selectedLabels.length === 0
              ? "Select states"
              : selectedLabels.length === 1
                ? selectedLabels[0]
                : `${selectedLabels.length} states selected`}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {selectedLabels.length === 0
              ? "Search by state name or abbreviation"
              : selectedLabels.join(", ")}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search states"
              disabled={disabled}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-brand-400 focus:outline-none"
            />
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto pr-1">
            {filteredStates.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                No states match that search.
              </p>
            ) : (
              filteredStates.map((state) => {
                const checked = selectedCodes.has(state.code);

                return (
                  <label
                    key={state.code}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      name="stateCodes"
                      value={state.code}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleState(state.code)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        checked
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-300 bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1">{state.name}</span>
                    <span className="font-mono text-xs text-slate-400">{state.code}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
