"use client";

import { useMemo, useState } from "react";
import { formatDateLabel, listDateRange } from "@/lib/daily-schedule";

type StateOption = { code: string; name: string };

type SubmitShowFormStepsProps = {
  categories: readonly string[];
  inputClass: string;
  states: StateOption[];
  timeOptions: string[];
};

export function SubmitShowFormSteps({ categories, inputClass, states, timeOptions }: SubmitShowFormStepsProps) {
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sameTimesEachDay, setSameTimesEachDay] = useState(true);
  const dailyDates = useMemo(() => {
    if (!isMultiDay || !startDate || !endDate) return [];
    return listDateRange(startDate, endDate);
  }, [endDate, isMultiDay, startDate]);

  return (
    <>
      <fieldset className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <legend className="px-2 text-sm font-semibold text-brand-700">Required show information</legend>
        <div className="mt-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900">
          Just six quick fields: show name, date, city, state, venue, and your private email.
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <label htmlFor="showName" className="mb-2 block text-sm font-medium text-slate-700">
              Show name <span className="text-red-600">*</span>
            </label>
            <input id="showName" name="showName" type="text" required autoFocus autoComplete="off" className={inputClass} placeholder="Example: Wichita Sports Card Show" />
          </div>

          <div className="rounded-3xl bg-slate-50 p-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="startDate" className="mb-2 block text-sm font-medium text-slate-700">
                  Show date <span className="text-red-600">*</span>
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
                    if (endDate && nextStartDate && endDate < nextStartDate) setEndDate(nextStartDate);
                  }}
                />
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={isMultiDay} onChange={(event) => setIsMultiDay(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  This show runs multiple days
                </label>
              </div>
            </div>
            {isMultiDay && (
              <div className="mt-5">
                <label htmlFor="endDate" className="mb-2 block text-sm font-medium text-slate-700">
                  End date <span className="text-red-600">*</span>
                </label>
                <input id="endDate" name="endDate" type="date" required min={startDate || undefined} className={inputClass} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="mb-2 block text-sm font-medium text-slate-700">City <span className="text-red-600">*</span></label>
              <input id="city" name="city" type="text" required autoCapitalize="words" autoComplete="address-level2" className={inputClass} placeholder="Wichita" />
            </div>
            <div>
              <label htmlFor="state" className="mb-2 block text-sm font-medium text-slate-700">State <span className="text-red-600">*</span></label>
              <select id="state" name="state" required defaultValue="" autoComplete="address-level1" className={inputClass}>
                <option value="">Choose a state</option>
                {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="venueName" className="mb-2 block text-sm font-medium text-slate-700">Venue name <span className="text-red-600">*</span></label>
              <input id="venueName" name="venueName" type="text" required autoComplete="organization" className={inputClass} placeholder="Hotel, convention center, card shop…" />
            </div>
            <div>
              <label htmlFor="venueAddress" className="mb-2 block text-sm font-medium text-slate-700">Street address <span className="font-normal text-slate-400">(optional)</span></label>
              <input id="venueAddress" name="venueAddress" type="text" autoComplete="street-address" className={inputClass} placeholder="123 Main St — leave blank if unknown" />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="submitterEmail" className="mb-2 block text-sm font-medium text-slate-700">Your private email <span className="text-red-600">*</span></label>
              <input id="submitterEmail" name="submitterEmail" type="email" required inputMode="email" autoCapitalize="off" autoComplete="email" className={inputClass} placeholder="you@example.com" aria-describedby="private-email-help" />
              <p id="private-email-help" className="mt-2 text-xs leading-5 text-slate-500">Used only to review your listing. It will not appear publicly.</p>
            </div>
            <div>
              <label htmlFor="submitterName" className="mb-2 block text-sm font-medium text-slate-700">Your name <span className="font-normal text-slate-400">(optional)</span></label>
              <input id="submitterName" name="submitterName" type="text" autoCapitalize="words" autoComplete="name" className={inputClass} placeholder="Jane Smith" />
            </div>
          </div>

          <div className="hidden" aria-hidden="true">
            <label htmlFor="companyWebsite">Leave this field blank</label>
            <input id="companyWebsite" name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            That&apos;s enough to submit. Everything below is optional, but extra details help more collectors find your show.
          </p>
        </div>
      </fieldset>

      <details className="group rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-700">Optional details</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">Add hours, admission, links, and show highlights</p>
          </div>
          <span aria-hidden className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition-transform group-open:rotate-180">v</span>
        </summary>

        <div className="mt-6 space-y-7">
          <section aria-labelledby="show-hours-heading">
            <h2 id="show-hours-heading" className="mb-3 text-sm font-semibold text-slate-800">Show hours</h2>
            {isMultiDay && (
              <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" name="sameTimesEachDay" checked={sameTimesEachDay} onChange={(event) => setSameTimesEachDay(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                Same hours each day
              </label>
            )}

            {(!isMultiDay || sameTimesEachDay) && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="startTimeLabel" className="mb-2 block text-sm font-medium text-slate-700">Start time</label>
                  <select id="startTimeLabel" name="startTimeLabel" defaultValue="" className={inputClass}>
                    <option value="">Not sure yet</option>
                    {timeOptions.map((timeOption) => <option key={timeOption} value={timeOption}>{timeOption}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="endTimeLabel" className="mb-2 block text-sm font-medium text-slate-700">End time</label>
                  <select id="endTimeLabel" name="endTimeLabel" defaultValue="" className={inputClass}>
                    <option value="">Not sure yet</option>
                    {timeOptions.map((timeOption) => <option key={timeOption} value={timeOption}>{timeOption}</option>)}
                  </select>
                </div>
              </div>
            )}

            {isMultiDay && !sameTimesEachDay && (
              <div className="space-y-3">
                <input type="hidden" name="sameTimesEachDay" value="off" />
                {dailyDates.length > 0 ? dailyDates.map((date) => (
                  <div key={date} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr]">
                    <p className="self-center text-sm font-semibold text-slate-800">{formatDateLabel(date)}</p>
                    <select name={`dailyStartTime_${date}`} required className={inputClass} defaultValue="">
                      <option value="">Start time</option>
                      {timeOptions.map((timeOption) => <option key={`${date}-start-${timeOption}`} value={timeOption}>{timeOption}</option>)}
                    </select>
                    <select name={`dailyEndTime_${date}`} required className={inputClass} defaultValue="">
                      <option value="">End time</option>
                      {timeOptions.map((timeOption) => <option key={`${date}-end-${timeOption}`} value={timeOption}>{timeOption}</option>)}
                    </select>
                  </div>
                )) : <p className="text-sm text-red-700">Choose valid start and end dates to enter daily hours.</p>}
              </div>
            )}
          </section>

          <section aria-labelledby="categories-heading">
            <h2 id="categories-heading" className="mb-3 text-sm font-semibold text-slate-800">What will be at the show?</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <label key={category} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 hover:border-brand-200 hover:bg-brand-50">
                  <input type="checkbox" name="categories" value={category} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </section>

          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">What should collectors know?</label>
            <textarea id="description" name="description" rows={4} className={`${inputClass} resize-y`} placeholder="Featured cards, special guests, trade night, giveaways, or anything else that makes the show special." />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="tableCount" className="mb-2 block text-sm font-medium text-slate-700">Approximate table count</label>
              <input id="tableCount" name="tableCount" type="number" inputMode="numeric" min="1" className={inputClass} placeholder="80" />
            </div>
            <div>
              <label htmlFor="vendorDetails" className="mb-2 block text-sm font-medium text-slate-700">Vendor information</label>
              <input id="vendorDetails" name="vendorDetails" type="text" className={inputClass} placeholder="Tables available, waitlist, setup time…" />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="websiteUrl" className="mb-2 block text-sm font-medium text-slate-700">Official website</label>
              <input id="websiteUrl" name="websiteUrl" type="url" inputMode="url" autoCapitalize="off" autoComplete="url" className={inputClass} placeholder="https://…" />
            </div>
            <div>
              <label htmlFor="facebookUrl" className="mb-2 block text-sm font-medium text-slate-700">Facebook event or social link</label>
              <input id="facebookUrl" name="facebookUrl" type="url" inputMode="url" autoCapitalize="off" className={inputClass} placeholder="https://facebook.com/events/…" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <label htmlFor="publicPromoterEmail" className="mb-2 block text-sm font-medium text-slate-700">Public promoter email</label>
            <input id="publicPromoterEmail" name="publicPromoterEmail" type="email" inputMode="email" autoCapitalize="off" className={inputClass} placeholder="contact@example.com" />
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600">
              <input type="checkbox" name="publicPromoterEmailConsent" className="mt-1 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              Publish this email so visitors can contact the promoter.
            </label>
          </div>

          <details className="group rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">Admission and parking</summary>
            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap gap-5 text-sm text-slate-700">
                <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="isFree" value="free" className="border-slate-300 text-brand-600 focus:ring-brand-500" />Free admission</label>
                <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="isFree" value="paid" defaultChecked className="border-slate-300 text-brand-600 focus:ring-brand-500" />Paid or unknown</label>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="admissionPrice" className="mb-2 block text-sm font-medium text-slate-700">Admission price</label>
                  <input id="admissionPrice" name="admissionPrice" type="text" className={inputClass} placeholder="$5 adults, kids free" />
                </div>
                <div>
                  <label htmlFor="admissionNotes" className="mb-2 block text-sm font-medium text-slate-700">Admission notes</label>
                  <input id="admissionNotes" name="admissionNotes" type="text" className={inputClass} placeholder="Early entry, cash only…" />
                </div>
              </div>
              <div>
                <label htmlFor="parkingInfo" className="mb-2 block text-sm font-medium text-slate-700">Parking information</label>
                <input id="parkingInfo" name="parkingInfo" type="text" className={inputClass} placeholder="Free lot, paid garage, entrance location…" />
              </div>
            </div>
          </details>
        </div>
      </details>
    </>
  );
}
