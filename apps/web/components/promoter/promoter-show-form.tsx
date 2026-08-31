"use client";

import { useMemo, useRef, useState } from "react";
import { FlyerUploadField } from "@/components/promoter/flyer-upload-field";
import { formatDateLabel, listDateRange } from "@/lib/daily-schedule";
import type { PromoterShowDefaults } from "@/lib/promoters";

type StateOption = {
  code: string;
  name: string;
};

type StepField =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement;

type PromoterShowFormProps = {
  categories: readonly string[];
  inputClass: string;
  organizerName: string;
  organizerEmail: string;
  organizerWebsiteUrl: string | null;
  organizerFacebookUrl: string | null;
  states: StateOption[];
  timeOptions: string[];
  defaults?: PromoterShowDefaults | null;
};

export function PromoterShowForm({
  categories,
  inputClass,
  organizerName,
  organizerEmail,
  organizerWebsiteUrl,
  organizerFacebookUrl,
  states,
  timeOptions,
  defaults,
}: PromoterShowFormProps) {
  const stepOneRef = useRef<HTMLFieldSetElement>(null);
  const stepTwoRef = useRef<HTMLDetailsElement>(null);
  const [isMultiDay, setIsMultiDay] = useState(
    Boolean(defaults?.endDate && defaults.startDate !== defaults.endDate)
  );
  const [isStepTwoOpen, setIsStepTwoOpen] = useState(Boolean(defaults));
  const [startDate, setStartDate] = useState(defaults?.startDate ?? "");
  const [endDate, setEndDate] = useState(defaults?.endDate ?? "");
  const [sameTimesEachDay, setSameTimesEachDay] = useState(true);
  const dailyDates = useMemo(() => {
    if (!isMultiDay || !startDate || !endDate) {
      return [];
    }

    return listDateRange(startDate, endDate);
  }, [endDate, isMultiDay, startDate]);

  function revealStepTwo() {
    const fields = Array.from(
      stepOneRef.current?.querySelectorAll("input, select, textarea") ?? []
    ) as StepField[];
    const firstInvalidField = fields.find(
      (field) => !field.disabled && !field.checkValidity()
    );

    if (firstInvalidField) {
      firstInvalidField.reportValidity();
      firstInvalidField.focus();
      return;
    }

    setIsStepTwoOpen(true);
    requestAnimationFrame(() => {
      stepTwoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <>
      <fieldset
        ref={stepOneRef}
        className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <legend className="px-2 text-sm font-semibold text-slate-700">
          Step 1 · Show basics
        </legend>

        <div className="mt-2 space-y-5">
          <div>
            <label
              htmlFor="showName"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Show name *
            </label>
            <input
              id="showName"
              name="showName"
              type="text"
              required
              className={inputClass}
              placeholder="Springfield Card and TCG Expo"
              defaultValue={defaults?.showName ?? ""}
            />
          </div>

          <div className="rounded-3xl bg-slate-50 p-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="startDate"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Show date *
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  className={inputClass}
                  value={startDate}
                  onChange={(event) => {
                    const nextStartDate = event.target.value;
                    setStartDate(nextStartDate);
                    if (endDate && nextStartDate && endDate < nextStartDate) {
                      setEndDate(nextStartDate);
                    }
                  }}
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isMultiDay}
                    onChange={(event) => setIsMultiDay(event.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Multi-day show
                </label>
              </div>
            </div>

            {isMultiDay && (
              <div className="mt-5">
                <label
                  htmlFor="endDate"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  End date *
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required={isMultiDay}
                  min={startDate || undefined}
                  className={inputClass}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            {isMultiDay && (
              <label className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="sameTimesEachDay"
                  checked={sameTimesEachDay}
                  onChange={(event) => setSameTimesEachDay(event.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Same start and end time each day
              </label>
            )}

            {(!isMultiDay || sameTimesEachDay) && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="startTimeLabel"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Start time
                  </label>
                  <select
                    id="startTimeLabel"
                    name="startTimeLabel"
                    defaultValue={defaults?.startTimeLabel ?? ""}
                    className={inputClass}
                  >
                    <option value="">Select start time</option>
                    {timeOptions.map((timeOption) => (
                      <option key={timeOption} value={timeOption}>
                        {timeOption}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="endTimeLabel"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    End time
                  </label>
                  <select
                    id="endTimeLabel"
                    name="endTimeLabel"
                    defaultValue={defaults?.endTimeLabel ?? ""}
                    className={inputClass}
                  >
                    <option value="">Select end time</option>
                    {timeOptions.map((timeOption) => (
                      <option key={timeOption} value={timeOption}>
                        {timeOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isMultiDay && !sameTimesEachDay && (
              <div className="space-y-3">
                <input type="hidden" name="sameTimesEachDay" value="off" />
                {dailyDates.length > 0 ? (
                  dailyDates.map((date) => (
                    <div
                      key={date}
                      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_1fr]"
                    >
                      <p className="self-center text-sm font-semibold text-slate-800">
                        {formatDateLabel(date)}
                      </p>
                      <select
                        name={`dailyStartTime_${date}`}
                        required
                        className={inputClass}
                        defaultValue=""
                      >
                        <option value="">Start time</option>
                        {timeOptions.map((timeOption) => (
                          <option key={`${date}-start-${timeOption}`} value={timeOption}>
                            {timeOption}
                          </option>
                        ))}
                      </select>
                      <select
                        name={`dailyEndTime_${date}`}
                        required
                        className={inputClass}
                        defaultValue=""
                      >
                        <option value="">End time</option>
                        {timeOptions.map((timeOption) => (
                          <option key={`${date}-end-${timeOption}`} value={timeOption}>
                            {timeOption}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-red-700">
                    Choose a valid start and end date to enter daily times.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="city"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                City *
              </label>
              <input
                id="city"
                name="city"
                type="text"
                required
                autoCapitalize="words"
                className={inputClass}
                placeholder="Springfield"
                defaultValue={defaults?.city ?? ""}
              />
            </div>

            <div>
              <label
                htmlFor="state"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                State *
              </label>
              <select
                id="state"
                name="state"
                required
                defaultValue={defaults?.state ?? ""}
                className={inputClass}
              >
                <option value="">Select a state</option>
                {states.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={revealStepTwo}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              Continue to details
            </button>
          </div>
        </div>
      </fieldset>

      <details
        ref={stepTwoRef}
        open={isStepTwoOpen}
        onToggle={(event) => setIsStepTwoOpen(event.currentTarget.open)}
        className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-700">
              Step 2 · Venue and listing details
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              Reuse your promoter profile and fill in only what changes
            </p>
          </div>
          <span
            aria-hidden
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition-transform group-open:rotate-180"
          >
            v
          </span>
        </summary>

        <div className="mt-6 space-y-6">
          <div className="rounded-3xl border border-brand-100 bg-brand-50/60 p-5">
            <p className="text-sm font-semibold text-slate-900">Posting as</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{organizerName}</p>
            <p className="mt-1 text-sm text-slate-600">Private account: {organizerEmail}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your profile links are prefilled below so you do not need to retype them for each
              show.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label
                htmlFor="venueName"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Venue name *
              </label>
              <input
                id="venueName"
                name="venueName"
                type="text"
                required
                className={inputClass}
                placeholder="Convention center, hotel ballroom, mall hall"
                defaultValue={defaults?.venueName ?? ""}
              />
            </div>

            <div>
              <label
                htmlFor="venueAddress"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Street address
              </label>
              <input
                id="venueAddress"
                name="venueAddress"
                type="text"
                className={inputClass}
                placeholder="123 Main St"
                defaultValue={defaults?.venueAddress ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="websiteUrl"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Website URL
              </label>
              <input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                defaultValue={defaults?.websiteUrl ?? organizerWebsiteUrl ?? ""}
                className={inputClass}
                placeholder="example.com or https://example.com"
              />
            </div>
            <div>
              <label
                htmlFor="facebookUrl"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Social or Facebook event URL
              </label>
              <input
                id="facebookUrl"
                name="facebookUrl"
                type="url"
                defaultValue={defaults?.facebookUrl ?? organizerFacebookUrl ?? ""}
                className={inputClass}
                placeholder="facebook.com/events/... or https://facebook.com/events/..."
              />
            </div>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            Plain domains work here too. We will add https:// automatically.
          </p>

          <FlyerUploadField inputClass={inputClass} />

          <details className="group rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-700">
              <span>Add more show details</span>
              <span
                aria-hidden
                className="text-slate-400 transition-transform group-open:rotate-180"
              >
                v
              </span>
            </summary>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Categories
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50"
                    >
                      <input
                        type="checkbox"
                        name="categories"
                        value={category}
                        defaultChecked={defaults?.categories.includes(category) ?? false}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  className={`${inputClass} resize-none`}
                  placeholder="What makes this show worth the trip, what categories are strongest, and what should collectors expect?"
                  defaultValue={defaults?.description ?? ""}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="tableCount"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Approximate table count
                  </label>
                  <input
                    id="tableCount"
                    name="tableCount"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    className={inputClass}
                    placeholder="80"
                    defaultValue={defaults?.tableCount ?? ""}
                  />
                </div>
                <div>
                  <label
                    htmlFor="vendorDetails"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Vendor info
                  </label>
                  <input
                    id="vendorDetails"
                    name="vendorDetails"
                    type="text"
                    className={inputClass}
                    placeholder="Dealer tables available, waitlist, setup notes"
                    defaultValue={defaults?.vendorDetails ?? ""}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="parkingInfo"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Parking info
                </label>
                <input
                  id="parkingInfo"
                  name="parkingInfo"
                  type="text"
                  className={inputClass}
                  placeholder="Free lot in back, paid garage next door, etc."
                  defaultValue={defaults?.parkingInfo ?? ""}
                />
              </div>
            </div>
          </details>

          <details className="group rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-700">
              <span>Add admission details</span>
              <span
                aria-hidden
                className="text-slate-400 transition-transform group-open:rotate-180"
              >
                v
              </span>
            </summary>

            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap gap-5 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isFree"
                    value="unknown"
                    defaultChecked={!defaults}
                    className="border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  N/A
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isFree"
                    value="free"
                    defaultChecked={defaults?.isFree === true}
                    className="border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Free
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isFree"
                    value="paid"
                    defaultChecked={defaults ? !defaults.isFree : false}
                    className="border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Paid
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="admissionPrice"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Admission price
                  </label>
                  <input
                    id="admissionPrice"
                    name="admissionPrice"
                    type="text"
                    className={inputClass}
                    placeholder="$5 adults, kids under 12 free"
                    defaultValue={defaults?.admissionPrice ?? ""}
                  />
                </div>
                <div>
                  <label
                    htmlFor="admissionNotes"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Admission notes
                  </label>
                  <input
                    id="admissionNotes"
                    name="admissionNotes"
                    type="text"
                    className={inputClass}
                    placeholder="VIP hour at 8 AM, cash only at door"
                    defaultValue={defaults?.admissionNotes ?? ""}
                  />
                </div>
              </div>
            </div>
          </details>
        </div>
      </details>
    </>
  );
}
