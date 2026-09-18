import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { US_STATES } from "@/lib/states";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatShowDate(startDate: Date, endDate: Date): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const fullDateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };

  const monthDayOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };

  if (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCDate() === end.getUTCDate()
  ) {
    return start.toLocaleDateString("en-US", fullDateOptions);
  }

  if (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth()
  ) {
    const startLabel = start.toLocaleDateString("en-US", monthDayOptions);
    return `${startLabel}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = start.toLocaleDateString(
    "en-US",
    sameYear ? monthDayOptions : fullDateOptions
  );
  const endLabel = end.toLocaleDateString("en-US", fullDateOptions);

  return `${startLabel}–${endLabel}`;
}

export function formatShortDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function getDateBadge(startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const month = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  const weekday = start.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

  let dayLabel = String(start.getUTCDate());

  if (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCDate() !== end.getUTCDate()
  ) {
    dayLabel = `${start.getUTCDate()}–${end.getUTCDate()}`;
  } else if (
    start.getUTCFullYear() !== end.getUTCFullYear() ||
    start.getUTCMonth() !== end.getUTCMonth()
  ) {
    dayLabel = `${start.getUTCDate()}+`;
  }

  return {
    month,
    weekday,
    dayLabel,
  };
}

export function stateCodeToSlug(code: string): string {
  return (
    US_STATES.find((state) => state.code === code.toUpperCase())?.slug ??
    code.toLowerCase()
  );
}

export function stateSlugToCode(slug: string): string | null {
  return US_STATES.find((state) => state.slug === slug.toLowerCase())?.code ?? null;
}

export function humanizeShowDate(startDate: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 7) {
    return `This ${new Date(startDate).toLocaleDateString("en-US", {
      weekday: "long",
    })}`;
  }

  return new Date(startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function generateShowSlug(
  title: string,
  city: string,
  state: string,
  startDate: Date
): string {
  const date = new Date(startDate);
  const monthYear = date
    .toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })
    .toLowerCase()
    .replace(" ", "-");

  return `${slugify(title)}-${slugify(city)}-${state.toLowerCase()}-${monthYear}`;
}
