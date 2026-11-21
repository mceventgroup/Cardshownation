export const WISCONSIN_WEEKEND_PATH = "/card-shows/wisconsin/this-weekend";
export const DALLAS_FORT_WORTH_PATH = "/card-shows/texas/dallas-fort-worth";

// Cities covered by this metro calendar, including nearby show destinations.
export const DALLAS_FORT_WORTH_CITIES = [
  "Addison", "Allen", "Arlington", "Bedford", "Carrollton", "Cedar Hill", "Coppell",
  "Dallas", "Denton", "DeSoto", "Euless", "Farmers Branch", "Flower Mound", "Forney",
  "Fort Worth", "Frisco", "Ft Worth", "Ft. Worth", "Garland", "Grand Prairie",
  "Grapevine", "Haltom City", "Hurst", "Irving", "Keller", "Lancaster",
  "Lewisville", "Little Elm", "Mansfield", "McKinney", "Mesquite", "Midlothian",
  "North Richland Hills", "Plano", "Prosper", "Richardson", "Richland Hills",
  "Rockwall", "Rowlett", "Southlake", "The Colony", "Watauga", "Waxahachie", "Wylie",
];

// Calendar dates are stored as UTC dates in the database. Calculate "today"
// in the venue's region, then do day arithmetic without DST or browser offsets.
export function centralCalendarDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
}

export function calendarDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addCalendarDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function getWeekendCalendar(now = new Date()) {
  const today = centralCalendarDay(now);
  const weekday = today.getUTCDay();
  const friday = addCalendarDays(today, weekday === 0 ? -2 : 5 - weekday);
  const sunday = addCalendarDays(friday, 2);
  return {
    friday,
    sunday,
    from: calendarDate(new Date(Math.max(today.getTime(), friday.getTime()))),
    before: calendarDate(addCalendarDays(sunday, 1)),
  };
}

export function getDallasFortWorthCalendar(now = new Date()) {
  const today = centralCalendarDay(now);
  return { from: calendarDate(today), before: calendarDate(addCalendarDays(today, 90)) };
}
