import assert from "node:assert/strict";
import test from "node:test";
import { mergeSeenExternalIds } from "./import-cursors";
import { getTcdbImportStateCodes, parseTcdbCalendarHtml } from "./tcdb";

test("parseTcdbCalendarHtml extracts shows from TCDB list markup", () => {
  const html = `
    <html>
      <body>
        <strong>Friday, June 19, 2026</strong>
        <ul>
          <li>6:00 PM - 10:00 PM - <a href="CardShows.cfm?MODE=VIEW&ID=26940">Friday Night Rip Show</a> (Tulsa, OK)</li>
          <li>7:00 PM - 9:00 PM - <a href="CardShows.cfm?MODE=VIEW&ID=26941">Pokemon Trade Night</a> (Broken Arrow, OK)</li>
        </ul>
        <strong>Saturday, June 20, 2026</strong>
        <ul>
          <li>9:00 AM - 4:00 PM - <a href="CardShows.cfm?MODE=VIEW&ID=26942">Midwest Sports Card Expo</a> (Wichita, KS)</li>
        </ul>
      </body>
    </html>
  `;

  const shows = parseTcdbCalendarHtml(html, "OK");

  assert.equal(shows.length, 3);
  assert.equal(shows[0]?.externalId, "tcdb:26940");
  assert.equal(shows[0]?.title, "Friday Night Rip Show");
  assert.equal(shows[0]?.city, "Tulsa");
  assert.equal(shows[0]?.state, "OK");
  assert.equal(shows[0]?.startDate.toISOString().slice(0, 10), "2026-06-19");
  assert.equal(shows[0]?.websiteUrl, null);
  assert.equal(shows[0]?.sourceUrl, null);
  assert.deepEqual(shows[1]?.categories, ["Pokemon"]);
  assert.deepEqual(shows[2]?.categories, ["Sports Cards"]);
});

test("parseTcdbCalendarHtml deduplicates duplicate links", () => {
  const html = `
    <html>
      <body>
        <strong>Saturday, June 20, 2026</strong>
        <ul>
          <li>9:00 AM - 4:00 PM - <a href="CardShows.cfm?MODE=VIEW&ID=26942">Midwest Sports Card Expo</a> (Wichita, KS)</li>
          <li>9:00 AM - 4:00 PM - <a href="CardShows.cfm?MODE=VIEW&ID=26942">Midwest Sports Card Expo</a> (Wichita, KS)</li>
        </ul>
      </body>
    </html>
  `;

  const shows = parseTcdbCalendarHtml(html, "KS");

  assert.equal(shows.length, 1);
});

test("parseTcdbCalendarHtml supports same-month date ranges", () => {
  const html = `
    <html>
      <body>
        <strong>June 20-22, 2026</strong>
        <ul>
          <li>9:00 AM - 4:00 PM - <a href="CardShows.cfm?MODE=VIEW&ID=30001">Three Day Card Show</a> (Dallas, TX)</li>
        </ul>
      </body>
    </html>
  `;

  const shows = parseTcdbCalendarHtml(html, "TX");

  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.startDate.toISOString().slice(0, 10), "2026-06-20");
  assert.equal(shows[0]?.endDate.toISOString().slice(0, 10), "2026-06-22");
});

test("parseTcdbCalendarHtml supports cross-month date ranges", () => {
  const html = `
    <html>
      <body>
        <strong>June 30, July 1, 2026</strong>
        <ul>
          <li>10:00 AM - 3:00 PM - <a href="CardShows.cfm?MODE=VIEW&ID=30002">Month Split Expo</a> (Phoenix, AZ)</li>
        </ul>
      </body>
    </html>
  `;

  const shows = parseTcdbCalendarHtml(html, "AZ");

  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.startDate.toISOString().slice(0, 10), "2026-06-30");
  assert.equal(shows[0]?.endDate.toISOString().slice(0, 10), "2026-07-01");
});

test("getTcdbImportStateCodes falls back to all U.S. states", () => {
  assert.equal(getTcdbImportStateCodes().length, 50);
  assert.equal(getTcdbImportStateCodes()[0], "AL");
  assert.equal(getTcdbImportStateCodes()[49], "WY");
});

test("mergeSeenExternalIds keeps newest ids first and removes duplicates", () => {
  assert.deepEqual(
    mergeSeenExternalIds(["tcdb:1", "tcdb:2", "tcdb:3"], ["tcdb:3", "tcdb:4", "tcdb:5"], 4),
    ["tcdb:3", "tcdb:4", "tcdb:5", "tcdb:1"]
  );
});
