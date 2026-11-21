import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  "base-url": { type: "string", default: "https://www.cardshownation.com" },
  output: { type: "string" },
} });
const base = new URL(values["base-url"]).origin;
const calendars = [
  { path: "/card-shows/wisconsin/this-weekend", parent: "/card-shows/wisconsin" },
  { path: "/card-shows/texas/dallas-fort-worth", parent: "/card-shows/texas" },
];
const read = async (path, userAgent) => {
  const response = await fetch(new URL(path, base), {
    headers: userAgent ? { "user-agent": userAgent } : undefined,
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, path + " failed for " + (userAgent ?? "a normal request"));
  assert.notEqual(response.headers.get("cf-mitigated"), "challenge", path + " served a Cloudflare challenge");
  return response.text();
};
const structuredData = html => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(match => {
    const data = JSON.parse(match[1]);
    return data["@graph"] ?? [data];
  });

const [robots, sitemap] = await Promise.all([read("/robots.txt"), read("/sitemap.xml")]);
if (new URL(base).hostname === "www.cardshownation.com") {
  assert.match(robots, /^sitemap:\s+https:\/\/www\.cardshownation\.com\/sitemap\.xml\s*$/mi);
}

const results = [];
for (const { path, parent } of calendars) {
  const [html, statePage] = await Promise.all([read(path), read(parent)]);
  assert.ok(statePage.includes('href="' + path + '"'), parent + " does not link to the calendar");
  const collection = structuredData(html).find(entry => entry["@type"] === "CollectionPage");
  assert.ok(collection, path + " is missing its collection markup");
  assert.ok(html.includes('rel="canonical" href="' + collection.url + '"')
    || html.includes('href="' + collection.url + '" rel="canonical"'), path + " canonical differs from markup");
  const shows = collection.mainEntity.itemListElement;
  const indexable = !/<meta name="robots" content="[^"]*noindex/i.test(html);
  if (new URL(base).hostname === "www.cardshownation.com") {
    assert.equal(indexable, shows.length > 0, path + " has incorrect indexing instructions");
    assert.equal(sitemap.includes("<loc>" + collection.url + "</loc>"), indexable, path + " sitemap differs from indexing instructions");
  }
  for (const item of shows) {
    assert.ok(html.includes('href="' + new URL(item.url).pathname + '"'), path + " markup contains an event without a visible link");
  }
  const sampled = shows.slice(0, 2);
  for (const item of sampled) {
    const event = structuredData(await read(new URL(item.url).pathname)).find(entry => entry["@type"] === "Event");
    assert.ok(event, item.url + " is missing Event markup");
    assert.match(event.startDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(event.endDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(event.endDate >= event.startDate, item.url + " end date is before start date");
  }
  // These requests test access from this runner. Verified bot traffic belongs in the CDN logs.
  const agents = ["OAI-SearchBot", "Googlebot", "bingbot", "Claude-SearchBot", "PerplexityBot"];
  await Promise.all(agents.map(agent => read(path, agent)));
  results.push({ path, shows: shows.length, indexable, checkedEventPages: sampled.length, successfulUserAgentProbes: agents.length });
}

const report = JSON.stringify({ checkedAt: new Date().toISOString(), base, calendars: results }, null, 2);
if (values.output) await writeFile(values.output, report + "\n");
console.log(report);
