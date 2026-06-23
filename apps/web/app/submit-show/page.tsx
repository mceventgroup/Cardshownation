import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SubmitShowFormSteps } from "@/components/submit/submit-show-form-steps";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { isValidDateInput, listDateRange } from "@/lib/daily-schedule";
import { SHOW_CATEGORIES } from "@/lib/shows";
import { US_STATES } from "@/lib/states";
import { createShowSubmission } from "@/lib/submissions";
import { normalizeExternalUrl } from "@/lib/url";
import { hashOpaqueToken } from "@/lib/token-hash";

export const metadata: Metadata = {
  title: "Submit a Card Show",
  description:
    "Submit a sports card, Pokemon, or TCG show to Card Show Nation for review.",
};

const MAX_SUBMISSIONS_PER_HOUR = 5;
const SUBMISSION_WINDOW_MS = 60 * 60 * 1000;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

async function handleSubmission(formData: FormData) {
  "use server";
  const honeypot = formData.get("companyWebsite");
  if (typeof honeypot === "string" && honeypot.trim()) {
    redirect("/submit-show/thank-you");
  }

  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit("submit-show", ip, {
    blockMs: SUBMISSION_WINDOW_MS,
    maxAttempts: MAX_SUBMISSIONS_PER_HOUR,
    windowMs: SUBMISSION_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    redirect("/submit-show?error=rate");
  }
  const submittedEmail = readRequiredString(formData, "submitterEmail", 320).toLowerCase();
  const emailRateLimit = await consumeRateLimit("submit-show-email", hashOpaqueToken(submittedEmail), {
    blockMs: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!emailRateLimit.allowed) redirect("/submit-show?error=rate");

  try {
    const submitterEmail = submittedEmail;
    const submitterNameInput = readOptionalString(formData, "submitterName", 120);
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
    const dailySchedule = readDailySchedule(formData, startDate, endDate, sameTimesEachDay);

    if (
      !submitterEmail ||
      !showName ||
      !city ||
      !venueName ||
      !state ||
      !isValidEmail(submitterEmail) ||
      !isValidDateInput(startDate) ||
      !isValidDateInput(endDate) ||
      endDate < startDate ||
      (!sameTimesEachDay && startDate !== endDate && !dailySchedule) ||
      !US_STATES.some((option) => option.code === state) ||
      (websiteUrlInput && !websiteUrl) ||
      (facebookUrlInput && !facebookUrl)
    ) {
      redirect("/submit-show?error=validation");
    }

    const submitterName = submitterNameInput ?? deriveSubmitterName(submitterEmail);
    const payload = {
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
        .filter((value): value is string => typeof value === "string" && SHOW_CATEGORIES.includes(value as (typeof SHOW_CATEGORIES)[number])),
      organizerName: submitterName,
      organizerEmail: submitterEmail,
      description: readOptionalString(formData, "description", 4000),
      tableCount: readOptionalString(formData, "tableCount", 6),
      vendorDetails: readOptionalString(formData, "vendorDetails", 200),
      websiteUrl,
      facebookUrl,
      isFree: formData.get("isFree") === "free",
      admissionPrice: readOptionalString(formData, "admissionPrice", 120),
      admissionNotes: readOptionalString(formData, "admissionNotes", 200),
      parkingInfo: readOptionalString(formData, "parkingInfo", 200),
    };

    await createShowSubmission({
      submitterName,
      submitterEmail,
      payloadJson: payload,
    });
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect("/submit-show?error=validation");
  }

  redirect("/submit-show/thank-you");
}

function deriveSubmitterName(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const cleaned = localPart.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "Card Show Promoter";
  }

  return cleaned
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
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

const inputClass =
  "w-full rounded-2xl border border-slate-200 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-brand-400 focus:outline-none";

const timeOptions = buildTimeOptions();

export default async function SubmitShowPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const errorMessage =
    sp.error === "rate"
      ? "Too many submissions from this connection. Please wait an hour and try again."
      : sp.error === "validation"
        ? "Please check your details and use valid email and URL values."
        : null;

  return (
    <div className="container-narrow py-6 sm:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
          Promoter submission
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          List your card show - free
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Reach collectors searching for shows in your city. Takes under a
          minute. No account needed. We review and publish within 24 hours.
        </p>
        <ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
          <li className="flex items-center gap-2">
            <span aria-hidden className="text-brand-600">&check;</span>
            Free listing
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="text-brand-600">&check;</span>
            Live within 24 hours
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="text-brand-600">&check;</span>
            No account needed
          </li>
        </ul>
        {errorMessage && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
      </div>

      <form action={handleSubmission} className="mt-8 space-y-8">
        <SubmitShowFormSteps
          categories={SHOW_CATEGORIES}
          inputClass={inputClass}
          states={US_STATES}
          timeOptions={timeOptions}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-500">
            Free listing. We review and publish within 24 hours. We&apos;ll
            only email you if we need to clarify something.
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Submit show &middot; Free
          </button>
        </div>
      </form>
    </div>
  );
}
