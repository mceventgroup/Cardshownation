import { US_STATES } from "@/lib/states";

export const FACEBOOK_MESSAGE_LIMIT = 60_000;
export type RoundupRange = { start: string; end: string };
export type RoundupShow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  state: string;
  city: string;
  startDate: Date;
  endDate: Date;
  expiresAt: Date | null;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  venue: { name: string } | null;
};
export type FacebookRoundup = {
  state: string;
  stateName: string;
  showCount: number;
  message: string;
};

export function roundupToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function roundupPresets(now = new Date()) {
  const today = roundupToday(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const sunday = addDays(today, (7 - weekday) % 7);
  return {
    thisWeek: { start: today, end: sunday },
    nextWeek: { start: addDays(sunday, 1), end: addDays(sunday, 7) },
    nextSevenDays: { start: today, end: addDays(today, 6) },
  };
}

export function validateRoundupRange(input: RoundupRange): string | null {
  for (const value of [input?.start, input?.end]) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Choose a valid start and end date.";
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "Choose a valid start and end date.";
  }
  if (input.end < input.start) return "The end date must be on or after the start date.";
  if ((Date.parse(input.end) - Date.parse(input.start)) / 86_400_000 > 30) return "Choose a date range of 31 days or less.";
  return null;
}

export function roundupDateLabel(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));
}

export function buildFacebookRoundups(
  shows: RoundupShow[], range: RoundupRange, siteUrl: string, now = new Date(),
): FacebookRoundup[] {
  const error = validateRoundupRange(range);
  if (error) throw new Error(error);
  const today = roundupToday(now);
  // Show dates are stored as calendar dates, not instants to shift into Central time.
  const eligible = shows.filter((show) => {
    const start = show.startDate.toISOString().slice(0, 10);
    const end = show.endDate.toISOString().slice(0, 10);
    return show.status === "APPROVED" && start <= range.end && end >= range.start && end >= today
      && (!show.expiresAt || show.expiresAt >= now);
  }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime() || a.city.localeCompare(b.city) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const baseUrl = siteUrl.replace(/\/+$/, "");
  return US_STATES.flatMap((state) => {
    const stateShows = eligible.filter((show) => show.state.trim().toUpperCase() === state.code);
    if (!stateShows.length) return [];
    const dates = range.start === range.end ? roundupDateLabel(range.start) : `${roundupDateLabel(range.start)} – ${roundupDateLabel(range.end)}`;
    const entries = stateShows.map((show) => {
      const start = show.startDate.toISOString().slice(0, 10);
      const end = show.endDate.toISOString().slice(0, 10);
      const date = start === end ? roundupDateLabel(start) : `${roundupDateLabel(start)} – ${roundupDateLabel(end)}`;
      // Multi-day schedules can vary; link to details instead of implying identical daily hours.
      const hours = start === end && show.startTimeLabel
        ? ` | ${show.startTimeLabel}${show.endTimeLabel ? ` – ${show.endTimeLabel}` : ""} (local time)` : "";
      return [
        `📍 ${show.city} — ${show.title}`,
        `${date}${hours}`,
        show.venue?.name,
        `${baseUrl}/shows/${encodeURIComponent(show.slug)}`,
      ].filter(Boolean).join("\n");
    });
    return [{
      state: state.code, stateName: state.name, showCount: stateShows.length,
      message: [
        `🃏 ${state.name.toUpperCase()} CARD SHOWS`, dates,
        `${stateShows.length} upcoming ${stateShows.length === 1 ? "show" : "shows"} to check out!`,
        entries.join("\n\n"),
        "Which show are you heading to? Tag your collecting crew!",
        `More ${state.name} shows: ${baseUrl}/card-shows/${state.slug}`,
        "Check show details for the latest hours and updates.",
        `#CardShowNation #CardShows #${state.name.replace(/\s/g, "")}CardShows`,
      ].join("\n\n"),
    }];
  });
}
