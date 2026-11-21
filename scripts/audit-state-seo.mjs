import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  "base-url": { type: "string", default: "https://www.cardshownation.com" },
  output: { type: "string", default: "../output/state-seo-audit" },
} });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(values["base-url"]).origin;
const source = await readFile(resolve(root, "apps/web/lib/states.ts"), "utf8");
const states = [...source.matchAll(/code: "([A-Z]{2})",\s*name: "([^"]+)",\s*slug: "([^"]+)"/g)]
  .map(([, code, name, slug]) => ({ code, name, slug }));
if (states.length !== 50) throw new Error(`Expected 50 states, found ${states.length}`);
const decode = (s = "") => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const plain = s => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, decode(v)]));
async function request(path) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(45000) });
  return { status: response.status, url: response.url, ms: Math.round(performance.now() - start),
    robotsHeader: response.headers.get("x-robots-tag") || "", html: await response.text() };
}
const infrastructure = await Promise.all(["/robots.txt", "/sitemap.xml"].map(async path => {
  try { return { path, ...await request(path) }; }
  catch (error) { return { path, status: 0, html: "", error: String(error) }; }
}));
const sitemap = infrastructure.find(item => item.path === "/sitemap.xml").html;
const rows = [];
const queue = [...states];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const state = queue.shift();
    const path = `/card-shows/${state.slug}`;
    try {
      const response = await request(path);
      const html = response.html;
      const meta = [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => attrs(tag));
      const links = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attrs(tag));
      const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
        .map(([, tag, body]) => ({ ...attrs(tag), text: plain(body) }));
      const jsonLd = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
        .flatMap(([, json]) => { try { const data = JSON.parse(json); return data["@graph"] ?? [data]; } catch { return [{ invalid: true }]; } });
      const collection = jsonLd.find(item => item["@type"] === "CollectionPage");
      const cityLinks = anchors.filter(a => a.href?.startsWith(`${path}/`));
      const cityTotal = cityLinks.reduce((sum, a) => sum + Number(a.text.match(/(\d+)\s*$/)?.[1] ?? 0), 0);
      const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? html;
      const text = plain(main.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""));
      const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(([, s]) => plain(s));
      const canonical = links.find(link => link.rel === "canonical")?.href ?? "";
      const description = meta.find(m => m.name === "description")?.content ?? "";
      const robots = meta.filter(m => ["robots", "googlebot"].includes(m.name)).map(m => m.content).join("; ");
      const issues = [];
      if (response.status !== 200) issues.push(`HTTP ${response.status}`);
      if (h1s.length !== 1) issues.push(`H1 count ${h1s.length}`);
      if (!canonical.endsWith(path)) issues.push("Missing or mismatched canonical");
      if (!description) issues.push("Missing description");
      if (/noindex/i.test(`${robots} ${response.robotsHeader}`)) issues.push("Noindex");
      if (!sitemap.includes(path + "<")) issues.push("Absent from sitemap");
      if (!collection) issues.push("Missing CollectionPage schema");
      if (!jsonLd.some(item => item["@type"] === "BreadcrumbList")) issues.push("Missing breadcrumb schema");
      if (jsonLd.some(item => item.invalid)) issues.push("Invalid JSON-LD");
      if (cityTotal > (collection?.mainEntity?.numberOfItems ?? 0) && !anchors.some(a => /\?page=2(?:$|#)/.test(a.href ?? ""))) issues.push("Listings truncated without pagination");
      if (/launch footprint|expansion market|strongest early markets|structured to make local discovery/.test(text)) issues.push("Generic or launch-stage copy");
      rows.push({ ...state, url: response.url, status: response.status, responseMs: response.ms,
        title: plain(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""), description, canonical, robots,
        robotsHeader: response.robotsHeader, h1: h1s.join(" | "), listedShows: collection?.mainEntity?.numberOfItems ?? 0,
        cities: cityLinks.length, cityNames: cityLinks.map(a => a.text.replace(/\d+\s*$/, "").trim()),
        cityListingTotal: cityTotal, inSitemap: sitemap.includes(path + "<"),
        showLinks: new Set(anchors.filter(a => a.href?.startsWith("/shows/")).map(a => a.href)).size,
        hasNextPage: anchors.some(a => /\?page=2(?:$|#)/.test(a.href ?? "")), issues });
    } catch (error) { rows.push({ ...state, url: `${base}${path}`, status: 0, issues: [String(error)] }); }
  }
}));
rows.sort((a, b) => a.name.localeCompare(b.name));
const report = { auditedAt: new Date().toISOString(), base, note: "HTML audit, not a Google ranking or Search Console indexing report. City totals are summed from visible city links.",
  infrastructure: infrastructure.map(({ html, ...rest }) => ({ ...rest, ...(rest.path === "/robots.txt" ? { body: html } : { urlCount: (html.match(/<loc>/g) || []).length }) })), states: rows };
const output = resolve(root, values.output);
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.json`, JSON.stringify(report, null, 2) + "\n");
const columns = ["name", "url", "status", "title", "description", "canonical", "robots", "robotsHeader", "listedShows", "cityListingTotal", "cities", "inSitemap", "hasNextPage", "issues"];
const csv = value => '"' + String(Array.isArray(value) ? value.join("; ") : value ?? "").replaceAll('"', '""') + '"';
await writeFile(`${output}.csv`, [columns.join(","), ...rows.map(row => columns.map(key => csv(row[key])).join(","))].join("\n") + "\n");
console.log(JSON.stringify({ audited: rows.length, http200: rows.filter(r => r.status === 200).length,
  issueCounts: rows.flatMap(r => r.issues).reduce((counts, issue) => ({ ...counts, [issue]: (counts[issue] ?? 0) + 1 }), {}),
  reports: [`${output}.json`, `${output}.csv`] }, null, 2));
