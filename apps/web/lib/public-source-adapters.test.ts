import assert from "node:assert/strict";
import test from "node:test";
import { parseComcCalendar, parseGasShows, parsePremierShows, parseShowDateRange, parseSportsCollectorsDigest } from "./public-source-adapters";

test("parses multi-day and cross-month show date ranges", () => {
  assert.equal(parseShowDateRange("September 25, 26 & 27, 2026")?.endDate.toISOString().slice(0, 10), "2026-09-27");
  assert.equal(parseShowDateRange("Oct 31 & Nov 1, 2026")?.endDate.toISOString().slice(0, 10), "2026-11-01");
  assert.equal(parseShowDateRange("April 23-25, 2027")?.endDate.toISOString().slice(0, 10), "2027-04-25");
});

test("COMC adapter imports only US card-show calendar entries", () => {
  const source = { name: "COMC Calendar", url: "https://calendar.comc.com/", adapter: "comc" as const };
  const shows = parseComcCalendar(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:show-1\nSUMMARY:COMC: The Philly Show\nDTSTART;VALUE=DATE:20260925\nDTEND;VALUE=DATE:20260928\nLOCATION:Greater Philadelphia Expo Center, 100 Station Ave, Oaks, PA 19456\nDESCRIPTION:Hall A\\nBooth 435\nURL:https://phillyshow.com/\nCATEGORIES:Card Shows\nEND:VEVENT\nBEGIN:VEVENT\nUID:auction-1\nSUMMARY:COMC Auction\nDTSTART;VALUE=DATE:20260925\nCATEGORIES:Live Auctions\nEND:VEVENT\nEND:VCALENDAR`, source);
  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.title, "The Philly Show");
  assert.equal(shows[0]?.city, "Oaks");
  assert.equal(shows[0]?.state, "PA");
  assert.equal(shows[0]?.endDate.toISOString().slice(0, 10), "2026-09-27");
});

test("GAS adapter reads every accordion show with venue details", () => {
  const html = `<li class="accordion-item"><span class="accordion-item__title">Independence, MO - Sept 5 &amp; 6, 2026</span><div class="accordion-item__description"><p>160 Tables</p><p>Free Admission</p><p>Saturday 10AM to 5PM</p><p>Stoney Creek Hotel Conference Center</p><p>18011 Bass Pro Dr, Independence, MO 64055</p></div></li>`;
  const shows = parseGasShows(html, { name: "G.A.S. Card Shows", url: "https://www.gas-shows.com/", adapter: "gas" });
  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.city, "Independence");
  assert.equal(shows[0]?.venueName, "Stoney Creek Hotel Conference Center");
  assert.equal(shows[0]?.tableCount, 160);
  assert.equal(shows[0]?.isFree, true);
});

test("Premier adapter reads repeated show cards", () => {
  const html = `<h2>NEXT SHOW</h2><h1>Hard Rock Live Rockford</h1><h2>7801 E State St, Rockford, IL 61108, USA</h2><h2>Sunday, Sep 6, 2026</h2><h2>10:00 AM - 3:00 PM</h2><h3>150 Tables</h3><h3>Free Event</h3><h2>NEXT SHOW</h2><h1>Kane County Fairgrounds</h1><h2>525 S Randall Rd, St. Charles, IL 60174, USA</h2><h2>Saturday, Sep 12, 2026</h2><h2>9:00 AM - 3:00 PM</h2><h3>195 Tables</h3><h3>$5</h3>`;
  const shows = parsePremierShows(html, { name: "Premier Card Shows", url: "https://www.premiercardshows.com/", adapter: "premier" });
  assert.equal(shows.length, 2);
  assert.equal(shows[0]?.city, "Rockford");
  assert.equal(shows[0]?.isFree, true);
  assert.equal(shows[1]?.admissionPrice, "$5");
});

test("Sports Collectors Digest adapter reads state calendar article data", () => {
  const articleBody = "ALABAMASept 12 AL, Sheffield. Sheffield Muscle Shoals Sportscards and Memorabilia Show, Clarion Inn, 4900 Hatch Blvd., Sheffield, AL 35660. SH: 8AM-2PM. T: 30. A: Free. Contact: example.comARKANSASAwaiting new dates";
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Article", dateModified: "2026-09-03T12:00:00Z", articleBody })}</script>`;
  const shows = parseSportsCollectorsDigest(html, { name: "Sports Collectors Digest", url: "https://sportscollectorsdigest.com/collecting-101/show-calendar", adapter: "scd" });
  assert.equal(shows.length, 1);
  assert.equal(shows[0]?.title, "Sheffield Muscle Shoals Sportscards and Memorabilia Show");
  assert.equal(shows[0]?.city, "Sheffield");
  assert.equal(shows[0]?.state, "AL");
  assert.equal(shows[0]?.tableCount, 30);
});
