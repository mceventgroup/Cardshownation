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
  assert.equal(shows[0]?.websiteUrl, "https://www.tcdb.com/CardShows.cfm?MODE=VIEW&ID=26940");
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
