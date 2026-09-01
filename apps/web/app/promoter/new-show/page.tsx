import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PromoterShowForm } from "@/components/promoter/promoter-show-form";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import { requirePromoterSession } from "@/lib/promoter-auth";
import { createPromoterShow, getPromoterShowDefaults } from "@/lib/promoters";
import { isValidDateInput, listDateRange } from "@/lib/daily-schedule";
import { SHOW_CATEGORIES } from "@/lib/shows";
import { US_STATES } from "@/lib/states";
import { normalizeExternalUrl } from "@/lib/url";

export const metadata: Metadata = {
  title: "Create Show",
  description: "Post a new show from the Card Show Nation promoter portal.",
};

function readRequiredString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    return "";
  }

  return trimmed;
}

function readDailySchedule(
  formData: FormData,
  startDate: string,
  endDate: string,
  sameTimesEachDay: boolean
) {
  if (sameTimesEachDay || startDate === endDate) {
    return null;
  }

  const dates = listDateRange(startDate, endDate);
  if (dates.length === 0) {
    return null;
  }

  const schedule: Array<{ date: string; startTimeLabel: string; endTimeLabel: string }> = [];

  for (const date of dates) {
    const startTimeLabel = readRequiredString(formData, `dailyStartTime_${date}`, 32);
    const endTimeLabel = readRequiredString(formData, `dailyEndTime_${date}`, 32);

    if (!startTimeLabel || !endTimeLabel) {
      return null;
    }

    schedule.push({ date, startTimeLabel, endTimeLabel });
  }

  return schedule;
}

function readOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${key} is too long`);
  }

  return trimmed;
}

function buildTimeOptions() {
  const options: string[] = [];

  for (let hour = 6; hour <= 21; hour += 1) {
    for (const minute of [0, 30]) {
      const period = hour < 12 ? "AM" : "PM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      const displayMinute = minute === 0 ? "00" : "30";
      options.push(`${displayHour}:${displayMinute} ${period}`);
    }
  }

  options.push("10:00 PM");

  return options;
}

async function handleCreateShow(formData: FormData) {
  "use server";

  const session = await requirePromoterSession("/promoter/new-show");

  try {
    const showName = readRequiredString(formData, "showName", 160);
    const startDate = readRequiredString(formData, "startDate", 10);
    const endDate = readRequiredString(formData, "endDate", 10) || startDate;
    const sameTimesEachDay = formData.get("sameTimesEachDay") !== "off";
    const city = readRequiredString(formData, "city", 80);
    const state = readRequiredString(formData, "state", 2).toUpperCase();
    const venueName = readRequiredString(formData, "venueName", 160);
    const websiteUrlInput = readOptionalString(formData, "websiteUrl", 2048);
    const facebookUrlInput = readOptionalString(formData, "facebookUrl", 2048);
    const websiteUrl = normalizeExternalUrl(websiteUrlInput);
    const facebookUrl = normalizeExternalUrl(facebookUrlInput);
    const flyerFile = formData.get("flyerFile");
    const dailySchedule = readDailySchedule(formData, startDate, endDate, sameTimesEachDay);

    if (
      !showName ||
      !city ||
      !venueName ||
      !state ||
      !isValidDateInput(startDate) ||
      !isValidDateInput(endDate) ||
      endDate < startDate ||
      (!sameTimesEachDay && startDate !== endDate && !dailySchedule) ||
      !US_STATES.some((option) => option.code === state) ||
      (websiteUrlInput && !websiteUrl) ||
      (facebookUrlInput && !facebookUrl)
    ) {
      redirect("/promoter/new-show?error=validation");
    }

    const result = await createPromoterShow(session.user.id, {
      showName,
      startDate,
      endDate,
      sameTimesEachDay,
      dailySchedule,
      startTimeLabel: readOptionalString(formData, "startTimeLabel", 32),
      endTimeLabel: readOptionalString(formData, "endTimeLabel", 32),
      city,
      state,
      venueName,
      venueAddress: readOptionalString(formData, "venueAddress", 200),
      categories: formData
        .getAll("categories")
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            SHOW_CATEGORIES.includes(value as (typeof SHOW_CATEGORIES)[number])
        ),
      description: readOptionalString(formData, "description", 4000),
      tableCount: readOptionalString(formData, "tableCount", 6),
      vendorDetails: readOptionalString(formData, "vendorDetails", 200),
      websiteUrl,
      facebookUrl,
      isFree: formData.get("isFree") === "free",
      admissionPrice: readOptionalString(formData, "admissionPrice", 120),
      admissionNotes: readOptionalString(formData, "admissionNotes", 200),
      parkingInfo: readOptionalString(formData, "parkingInfo", 200),
      flyerFile: flyerFile instanceof File ? flyerFile : null,
    });

    if (result.status === "BLOCKED") {
      redirect("/promoter/new-show?error=blocked");
    }
    if (result.status === "DUPLICATE") {
      redirect("/promoter/new-show?error=duplicate");
    }

    redirect(
      `/promoter?created=1&status=${
        result.status === "APPROVED" ? "approved" : "review"
      }`
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect("/promoter/new-show?error=validation");
  }
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-brand-400 focus:outline-none";

const timeOptions = buildTimeOptions();

export default async function NewPromoterShowPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; copy?: string }>;
}) {
  const session = await requirePromoterSession("/promoter/new-show");
  const sp = await searchParams;
  const defaults =
    typeof sp.copy === "string" && sp.copy
      ? await getPromoterShowDefaults(session.user.id, sp.copy)
      : null;
  const errorMessage =
    sp.error === "validation"
      ? "Check your dates, URLs, and flyer file before submitting again."
      : sp.error === "duplicate"
        ? "A matching show or pending submission already exists."
        : sp.error === "blocked"
          ? "This organizer is blocked from submitting shows. Contact Card Show Nation if you believe this is an error."
      : null;

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Promoter portal
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Create a new show
            </h1>
          </div>
          <Link
            href="/promoter"
            className="text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            Back to portal
          </Link>
        </div>

        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Post from your saved organizer account and keep your show details attached to one
          promoter profile.
        </p>

        {defaults && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Copied from previous show</p>
              <p className="mt-1">
                This form is prefilled from a previous show. Update the dates and any
                event-specific details before submitting.
              </p>
            </div>
            <Link
              href="/promoter/new-show"
              className="inline-flex items-center justify-center rounded-full border border-brand-300 bg-white px-4 py-2 text-xs font-semibold text-brand-900 transition-colors hover:bg-brand-100"
            >
              Clear prefill
            </Link>
          </div>
        )}

        {errorMessage && (
          <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
      </div>

      <form action={handleCreateShow} className="mt-8 space-y-8">
        <PromoterShowForm
          categories={SHOW_CATEGORIES}
          inputClass={inputClass}
          organizerName={session.organizer.name}
          organizerEmail={session.user.email}
          organizerWebsiteUrl={session.organizer.websiteUrl}
          organizerFacebookUrl={session.organizer.facebookUrl}
          states={US_STATES}
          timeOptions={timeOptions}
          defaults={defaults}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-500">
            By submitting, you confirm you are authorized to publish these details and agree to our <Link href="/terms" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Terms</Link>. See the <Link href="/privacy" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Privacy Policy</Link>.
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Submit show
          </button>
        </div>
      </form>
    </div>
  );
}
