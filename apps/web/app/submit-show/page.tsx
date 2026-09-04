import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Check, Upload } from "lucide-react";
import { SubmitShowForm, type SubmitShowFormState } from "@/components/submit/submit-show-form";
import { SubmitShowFormSteps } from "@/components/submit/submit-show-form-steps";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { isValidDateInput, listDateRange } from "@/lib/daily-schedule";
import { SHOW_CATEGORIES } from "@/lib/shows";
import { US_STATES } from "@/lib/states";
import { submitShowForModeration } from "@/lib/submissions";
import { normalizeExternalUrl } from "@/lib/url";
import { hashOpaqueToken } from "@/lib/token-hash";
import { saveFlyerImage } from "@/lib/flyers";

export const metadata: Metadata = {
  title: "Submit a Card Show",
  description:
    "Add a sports card, Pokemon, or TCG show to the Card Show Nation directory for free. No account required.",
  alternates: { canonical: "/submit-show" },
  openGraph: {
    title: "Submit a Card Show Free",
    description: "Help collectors find an upcoming card show. Add it to Card Show Nation for free—no account required.",
    url: "/submit-show",
  },
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

async function handleSubmission(
  _state: SubmitShowFormState,
  formData: FormData
): Promise<SubmitShowFormState> {
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
    return {
      code: "rate",
      message: "Too many submissions from this connection. Please wait an hour and try again.",
    };
  }
  const submittedEmail = readRequiredString(formData, "submitterEmail", 320).toLowerCase();
  const emailRateLimit = await consumeRateLimit("submit-show-email", hashOpaqueToken(submittedEmail), {
    blockMs: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!emailRateLimit.allowed) {
    return {
      code: "rate",
      message: "This email has reached today’s submission limit. Please try again tomorrow.",
    };
  }

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
    const publicPromoterEmailInput = readOptionalString(formData, "publicPromoterEmail", 320);
    const publicPromoterEmailConsent = formData.get("publicPromoterEmailConsent") === "on";
    const flyerFile = formData.get("flyerFile");
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
      (facebookUrlInput && !facebookUrl) ||
      (publicPromoterEmailInput && (!publicPromoterEmailConsent || !isValidEmail(publicPromoterEmailInput)))
    ) {
      return {
        code: "validation",
        message: "Please check the required fields and use valid email, date, and website values. Your entries are still here.",
      };
    }

    const submitterName = submitterNameInput ?? deriveSubmitterName(submitterEmail);
    const flyerImageUrl = flyerFile instanceof File && flyerFile.size > 0
      ? await saveFlyerImage(showName, flyerFile)
      : null;
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
      publicPromoterEmail: publicPromoterEmailInput?.toLowerCase() ?? null,
      publicPromoterEmailConsent,
      description: readOptionalString(formData, "description", 4000),
      tableCount: readOptionalString(formData, "tableCount", 6),
      vendorDetails: readOptionalString(formData, "vendorDetails", 200),
      websiteUrl,
      facebookUrl,
      isFree: formData.get("isFree") === "free",
      admissionPrice: readOptionalString(formData, "admissionPrice", 120),
      admissionNotes: readOptionalString(formData, "admissionNotes", 200),
      parkingInfo: readOptionalString(formData, "parkingInfo", 200),
      flyerImageUrl,
    };

    const result = await submitShowForModeration({
      submitterName,
      submitterEmail,
      payloadJson: payload,
    });

    if (result.status === "BLOCKED") {
      return {
        code: "blocked",
        message: "We cannot accept submissions from this organizer. Contact Card Show Nation if you believe this is an error.",
      };
    }
    if (result.status === "DUPLICATE") {
      return {
        code: "duplicate",
        message: "This show appears to be listed already, so you do not need to enter it again.",
      };
    }
  } catch (error) {
    return {
      code: "validation",
      message: "We couldn’t submit the show. Please check the details and try again—your entries are still here.",
    };
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
        : sp.error === "duplicate"
          ? "A matching show or pending submission already exists."
          : sp.error === "blocked"
            ? "We cannot accept submissions from this organizer. Contact Card Show Nation if you believe this is an error."
        : null;
  const initialState: SubmitShowFormState = sp.error && errorMessage
    ? { code: sp.error as SubmitShowFormState["code"], message: errorMessage }
    : {};

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
            <Check aria-hidden className="h-4 w-4 text-brand-600" />
            Free listing
          </li>
          <li className="flex items-center gap-2">
            <Check aria-hidden className="h-4 w-4 text-brand-600" />
            Live within 24 hours
          </li>
          <li className="flex items-center gap-2">
            <Check aria-hidden className="h-4 w-4 text-brand-600" />
            No account needed
          </li>
        </ul>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white"><CalendarDays className="h-5 w-5" aria-hidden /></span>
            <div><p className="font-semibold text-slate-950">Submit one show</p><p className="text-sm text-slate-600">Use the quick form below</p></div>
          </div>
        </div>
        <Link href="/submit-shows" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-brand-700 transition-colors group-hover:bg-brand-100"><Upload className="h-5 w-5" aria-hidden /></span>
            <div><p className="font-semibold text-slate-950">Upload multiple shows</p><p className="text-sm text-slate-600">Add a full schedule from a spreadsheet</p></div>
          </div>
        </Link>
      </div>

      <SubmitShowForm action={handleSubmission} initialState={initialState}>
        <SubmitShowFormSteps
          categories={SHOW_CATEGORIES}
          inputClass={inputClass}
          states={US_STATES}
          timeOptions={timeOptions}
        />

      </SubmitShowForm>
    </div>
  );
}
