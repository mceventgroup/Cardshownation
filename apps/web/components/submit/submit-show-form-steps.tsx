"use client";

import { useMemo, useRef, useState } from "react";
import { formatDateLabel, listDateRange } from "@/lib/daily-schedule";

type StateOption = {
  code: string;
  name: string;
};

type StepField =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement;

type SubmitShowFormStepsProps = {
  categories: readonly string[];
  inputClass: string;
  states: StateOption[];
  timeOptions: string[];
};

export function SubmitShowFormSteps({
  categories,
  inputClass,
  states,
  timeOptions,
}: SubmitShowFormStepsProps) {
  const stepOneRef = useRef<HTMLFieldSetElement>(null);
  const stepTwoRef = useRef<HTMLDetailsElement>(null);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [isStepTwoOpen, setIsStepTwoOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
          Step 1 · What and When
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
              placeholder="Wichita Sports Card Show"
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
                    defaultValue=""
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
                    defaultValue=""
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
                placeholder="Wichita"
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
                defaultValue=""
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
              Continue to where and contact
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
              Step 2 · Where and Contact
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              Venue, private contact, and optional extras
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
          <div className="hidden" aria-hidden="true">
            <label htmlFor="companyWebsite">Leave this field blank</label>
            <input
              id="companyWebsite"
              name="companyWebsite"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
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
                placeholder="Convention center, hotel ballroom, civic center"
              />
            </div>

            <div>
              <label
                htmlFor="venueAddress"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Street address (optional)
              </label>
              <input
                id="venueAddress"
                name="venueAddress"
                type="text"
                className={inputClass}
                placeholder="123 Main St - leave blank if unsure"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="submitterName"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Your name
              </label>
              <input
                id="submitterName"
                name="submitterName"
                type="text"
                autoCapitalize="words"
                className={inputClass}
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label
                htmlFor="submitterEmail"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Your private email *
              </label>
              <input
                id="submitterEmail"
                name="submitterEmail"
                type="email"
                required
                inputMode="email"
                autoCapitalize="off"
                autoComplete="email"
                className={inputClass}
                placeholder="jane@example.com"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Used by Card Show Nation to review this submission. This email is not published.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <label
              htmlFor="publicPromoterEmail"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Public promoter email
            </label>
            <input
              id="publicPromoterEmail"
              name="publicPromoterEmail"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              autoComplete="email"
              className={inputClass}
              placeholder="contact@example.com"
            />
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-600">
              <input
                type="checkbox"
                name="publicPromoterEmailConsent"
                className="mt-1 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                Publish this email on the show page so visitors can contact the promoter.
              </span>
            </label>
          </div>

          <details className="group rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-700">
              <span>Add more show details (optional)</span>
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
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {categories.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50"
                    >
                      <input
                        type="checkbox"
                        name="categories"
                        value={category}
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
                  placeholder="Tell collectors what to expect, what categories are strongest, and anything important about the event."
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
                    placeholder="Dealer tables available, waitlist only, setup starts at 7 AM"
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
                    className={inputClass}
                    placeholder="https://..."
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
                    className={inputClass}
                    placeholder="https://facebook.com/events/..."
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
                  placeholder="Free lot on the north side, paid garage next door, etc."
                />
              </div>
            </div>
          </details>

          <details className="group rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-700">
              <span>Add admission details (optional)</span>
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
                    value="free"
                    className="border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Free
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="isFree"
                    value="paid"
                    defaultChecked
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
                    placeholder="$5 adults, kids 12 and under free"
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
                    placeholder="Early entry at 8 AM, cash only at door, etc."
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
