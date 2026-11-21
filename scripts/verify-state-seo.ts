import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { US_STATES } from "../apps/web/lib/states";
import { FIXTURE_SHOWS } from "../apps/web/lib/fixture-data";

async function main() {
  const originalCwd = process.cwd();
  const temporaryParent = resolve(originalCwd, "tmp");
  await mkdir(temporaryParent, { recursive: true });
  const temporaryRoot = await mkdtemp(join(temporaryParent, "state-seo-"));
  const previousMode = process.env.CSN_DATA_MODE;
  process.env.CSN_DATA_MODE = "fixture";
  try {
    await mkdir(join(temporaryRoot, "data"));
    const fixtures = Array.from({ length: 30 }, (_, i) => ({
      ...FIXTURE_SHOWS[0], id: `seo-test-${i}`, slug: `seo-test-${i}`, title: `Alaska SEO test ${String(i).padStart(2, "0")}`,
      state: "AK", city: "Anchorage", featuredRank: null, status: "APPROVED",
      startDate: "2099-01-02T00:00:00.000Z", endDate: "2099-01-03T00:00:00.000Z", expiresAt: null,
      isFree: i % 2 === 0,
      venue: { ...FIXTURE_SHOWS[0].venue, name: "Test venue", city: "Anchorage", state: "AK" },
    }));
    await writeFile(join(temporaryRoot, "data/fixture-local-shows.json"), JSON.stringify(fixtures));
    process.chdir(temporaryRoot);
    const { default: StatePage, generateMetadata } = await import("../apps/web/app/card-shows/[state]/page");
    const props = (state: string, page?: string) => ({ params: Promise.resolve({ state }), searchParams: Promise.resolve(page ? { page } : {}) });
    const render = async (state: string, page?: string) => renderToStaticMarkup(await StatePage(props(state, page)));
    for (const state of US_STATES) {
      const html = await render(state.slug);
      assert.equal((html.match(/<h1\b/g) ?? []).length, 1, state.name);
      assert.ok(html.includes(`Upcoming ${state.name} card shows`), state.name);
      assert.ok(html.includes(`Planning a card show trip in ${state.name}`), state.name);
      assert.ok(!/launch footprint|expansion market|future promoter profiles/.test(html));
      const metadata = await generateMetadata(props(state.slug));
      assert.equal(metadata.alternates?.canonical, `/card-shows/${state.slug}`);
      for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        const graph = JSON.parse(json)["@graph"];
        assert.equal(graph[0]["@type"], "CollectionPage");
        assert.equal(graph[1]["@type"], "BreadcrumbList");
        assert.equal(graph[0].mainEntity.itemListElement.length, state.code === "AK" ? 24 : 0);
      }
    }
    const first = await render("alaska");
    const second = await render("alaska", "2");
    assert.match(first, /Showing 1–24 of 30 upcoming Alaska listings/);
    assert.match(second, /Showing 25–30 of 30 upcoming Alaska listings/);
    assert.match(first, /href="\/card-shows\/alaska\?page=2"/);
    assert.ok(/<a\b(?=[^>]*href="\/card-shows\/alaska")(?=[^>]*rel="prev")[^>]*>/.test(second), "Page 2 links back to the canonical first page");
    assert.match(first, /Jan 2–3, 2099/);
    const showLinks = (html: string) => [...html.matchAll(/href="\/shows\/(seo-test-[^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set([...showLinks(first), ...showLinks(second)]).size, 30);
    assert.equal(showLinks(first).length, 24);
    assert.equal(showLinks(second).length, 6);
    const metadata = await generateMetadata(props("alaska", "2"));
    assert.equal(metadata.alternates?.canonical, "/card-shows/alaska?page=2");
    assert.match(String(metadata.title), /Page 2/);
    assert.equal(metadata.robots, undefined);
    assert.deepEqual((await generateMetadata(props("montana"))).robots, { index: false, follow: true });
    for (const invalid of ["0", "-1", "3", "10001"]) {
      await assert.rejects(() => render("alaska", invalid), /NEXT_HTTP_ERROR_FALLBACK;404/);
    }
    await assert.rejects(() => render("not-a-state"), /NEXT_HTTP_ERROR_FALLBACK;404/);
    console.log("PASS: rendered all 50 state pages; verified metadata, schema, 30-event pagination, totals, date ranges, empty-state indexing, and invalid-page handling using isolated fixtures.");
  } finally {
    process.chdir(originalCwd);
    if (previousMode === undefined) delete process.env.CSN_DATA_MODE;
    else process.env.CSN_DATA_MODE = previousMode;
    // Delete only the exact generated fixture directory within this checkout.
    assert.equal(dirname(resolve(temporaryRoot)), temporaryParent);
    assert.ok(temporaryRoot.startsWith(join(temporaryParent, "state-seo-")));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
