import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PromoterShowForm } from "@/components/promoter/promoter-show-form";
import { isValidDateInput, listDateRange } from "@/lib/daily-schedule";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import { requirePromoterSession } from "@/lib/promoter-auth";
import { createShowClaimUpdate, getClaimableShow } from "@/lib/promoters";
import { SHOW_CATEGORIES } from "@/lib/shows";
import { US_STATES } from "@/lib/states";
import { normalizeExternalUrl } from "@/lib/url";

export const metadata: Metadata = { title: "Claim or update show", robots: { index: false, follow: false } };
const inputClass = "w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-brand-400 focus:outline-none";

function requiredString(formData: FormData, key: string, max: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : "";
}

function optionalString(formData: FormData, key: string, max: number) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${key} is too long`);
  return trimmed;
}

function readDailySchedule(formData: FormData, startDate: string, endDate: string, sameTimesEachDay: boolean) {
  if (sameTimesEachDay || startDate === endDate) return null;
  const dates = listDateRange(startDate, endDate);
  if (!dates.length) return null;
  const schedule = dates.map((date) => ({
    date,
    startTimeLabel: requiredString(formData, `dailyStartTime_${date}`, 32),
    endTimeLabel: requiredString(formData, `dailyEndTime_${date}`, 32),
  }));
  return schedule.every((row) => row.startTimeLabel && row.endTimeLabel) ? schedule : null;
}

function buildTimeOptions() {
  const options: string[] = [];
  for (let hour = 6; hour <= 21; hour += 1) {
    for (const minute of [0, 30]) {
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      options.push(`${displayHour}:${minute === 0 ? "00" : "30"} ${hour < 12 ? "AM" : "PM"}`);
    }
  }
  options.push("10:00 PM");
  return options;
}

async function submitClaim(showId: string, formData: FormData) {
  "use server";
  const returnPath = `/promoter/claim-show/${encodeURIComponent(showId)}`;
  const session = await requirePromoterSession(returnPath);
  try {
    const showName = requiredString(formData, "showName", 160);
    const startDate = requiredString(formData, "startDate", 10);
    const endDate = requiredString(formData, "endDate", 10) || startDate;
    const city = requiredString(formData, "city", 80);
    const state = requiredString(formData, "state", 2).toUpperCase();
    const venueName = requiredString(formData, "venueName", 160);
    const relationship = requiredString(formData, "claimRelationship", 40);
    const claimEvidence = requiredString(formData, "claimEvidence", 1200);
    const sameTimesEachDay = formData.get("sameTimesEachDay") !== "off";
    const dailySchedule = readDailySchedule(formData, startDate, endDate, sameTimesEachDay);
    const websiteInput = optionalString(formData, "websiteUrl", 2048);
    const facebookInput = optionalString(formData, "facebookUrl", 2048);
    const websiteUrl = normalizeExternalUrl(websiteInput);
    const facebookUrl = normalizeExternalUrl(facebookInput);
    const allowedRelationships = ["PROMOTER", "AUTHORIZED_STAFF", "VENUE_PARTNER"];

    if (!showName || !city || !venueName || !claimEvidence || claimEvidence.length < 20 || !allowedRelationships.includes(relationship) || !isValidDateInput(startDate) || !isValidDateInput(endDate) || endDate < startDate || !US_STATES.some((option) => option.code === state) || (!sameTimesEachDay && startDate !== endDate && !dailySchedule) || (websiteInput && !websiteUrl) || (facebookInput && !facebookUrl)) {
      redirect(`${returnPath}?error=validation`);
    }

    const flyerFile = formData.get("flyerFile");
    const result = await createShowClaimUpdate(session.user.id, {
      claimTargetShowId: showId,
      claimRelationship: relationship as "PROMOTER" | "AUTHORIZED_STAFF" | "VENUE_PARTNER",
      claimEvidence,
      showName,
      startDate,
      endDate,
      sameTimesEachDay,
      dailySchedule,
      startTimeLabel: optionalString(formData, "startTimeLabel", 32),
      endTimeLabel: optionalString(formData, "endTimeLabel", 32),
      city,
      state,
      venueName,
      venueAddress: optionalString(formData, "venueAddress", 200),
      categories: formData.getAll("categories").filter((value): value is string => typeof value === "string" && SHOW_CATEGORIES.includes(value as (typeof SHOW_CATEGORIES)[number])),
      description: optionalString(formData, "description", 4000),
      tableCount: optionalString(formData, "tableCount", 6),
      vendorDetails: optionalString(formData, "vendorDetails", 200),
      websiteUrl,
      facebookUrl,
      isFree: formData.get("isFree") === "free",
      admissionPrice: optionalString(formData, "admissionPrice", 120),
      admissionNotes: optionalString(formData, "admissionNotes", 200),
      parkingInfo: optionalString(formData, "parkingInfo", 200),
      flyerFile: flyerFile instanceof File ? flyerFile : null,
    });
    if (result.status === "BLOCKED") redirect(`${returnPath}?error=blocked`);
    if (result.status === "DUPLICATE") redirect(`${returnPath}?error=pending`);
    if (result.status === "NOT_FOUND") notFound();
    redirect("/promoter?claim=sent");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${returnPath}?error=validation`);
  }
}

export default async function ClaimShowPage({ params, searchParams }: { params: Promise<{ showId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { showId } = await params;
  const returnPath = `/promoter/claim-show/${encodeURIComponent(showId)}`;
  const [session, show, sp] = await Promise.all([requirePromoterSession(returnPath), getClaimableShow(showId), searchParams]);
  if (!show) notFound();
  const submitWithId = submitClaim.bind(null, show.id);
  const ownedByAnotherOrganizer = Boolean(show.currentOrganizerId && show.currentOrganizerId !== session.organizer.id);
  const errorMessage = sp.error === "pending" ? "You already have a claim for this show awaiting review." : sp.error === "blocked" ? "This organizer account cannot submit updates right now." : sp.error ? "Check the required details and explain your connection to the show in at least 20 characters." : null;

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Verified promoter request</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Claim or update this show</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Correct the listing below and tell us how you are connected to the event. Nothing changes publicly until a reviewer approves it.</p>
        {ownedByAnotherOrganizer && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">This listing is currently connected to {show.currentOrganizerName ?? "another organizer"}. We will verify your explanation before changing ownership.</p>}
        {errorMessage && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
      </div>

      <form action={submitWithId} className="mt-8 space-y-8">
        <fieldset className="rounded-[2rem] border border-brand-200 bg-brand-50 p-6 shadow-sm">
          <legend className="px-2 text-sm font-semibold text-brand-900">Your connection to this show</legend>
          <div className="mt-2 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">Relationship *<select name="claimRelationship" required className={`${inputClass} mt-2 bg-white`} defaultValue=""><option value="" disabled>Select one</option><option value="PROMOTER">I promote or own this show</option><option value="AUTHORIZED_STAFF">I am authorized staff</option><option value="VENUE_PARTNER">I represent the venue</option></select></label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">How can we verify this? *<textarea name="claimEvidence" required minLength={20} maxLength={1200} rows={4} className={`${inputClass} mt-2`} placeholder="For example: I am listed as the contact on the event website, or email me at the address shown on the flyer." /><span className="mt-2 block text-xs leading-5 text-slate-500">Include a public link or a specific verification detail. Do not enter passwords or private account information.</span></label>
          </div>
        </fieldset>

        <PromoterShowForm categories={SHOW_CATEGORIES} inputClass={inputClass} organizerName={session.organizer.name} organizerEmail={session.user.email} organizerWebsiteUrl={session.organizer.websiteUrl} organizerFacebookUrl={session.organizer.facebookUrl} states={US_STATES} timeOptions={buildTimeOptions()} defaults={show.defaults} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-500">By submitting, you confirm you are authorized to request these changes. Reviewers can reject the claim or ask for corrections.</p>
          <button type="submit" className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700">Send for review</button>
        </div>
      </form>
      <Link href={`/shows/${show.slug}`} className="mt-6 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-800">Back to show</Link>
    </div>
  );
}
