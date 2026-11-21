import test from "node:test";
import assert from "node:assert/strict";
import { US_STATES } from "./states";
import { STATE_GUIDES } from "./state-guides";
import { getStateSeo, parseStatePage, statePagePath } from "./state-seo";
import { isUpcomingCalendarShow, upcomingShowWhere } from "./show-calendar";

test("all 50 states have distinct local guidance and valid related-state links", () => {
  const codes = new Set(US_STATES.map(state => state.code));
  assert.equal(codes.size, 50);
  assert.deepEqual(Object.keys(STATE_GUIDES).sort(), [...codes].sort());
  assert.equal(new Set(Object.values(STATE_GUIDES).map(guide => guide.planning)).size, 50);
  const descriptions = new Set<string>();
  for (const state of US_STATES) {
    const seo = getStateSeo(state);
    assert.ok(seo.title.startsWith(`${state.name} Card Shows`));
    assert.ok(seo.description.includes(state.name));
    assert.ok(seo.guide.cities.length >= 3);
    for (const nearby of seo.guide.nearby) {
      assert.ok(codes.has(nearby), `${state.code}: unknown neighbor ${nearby}`);
      assert.notEqual(nearby, state.code);
    }
    assert.equal(seo.path, `/card-shows/${state.slug}`);
    descriptions.add(seo.description);
  }
  assert.equal(descriptions.size, 50);
});

test("pagination has distinct canonicals and rejects ambiguous or excessive input", () => {
  assert.equal(parseStatePage(undefined), 1);
  assert.equal(parseStatePage("1"), 1);
  assert.equal(parseStatePage("2"), 2);
  for (const bad of ["", "0", "-1", "01", "1.2", "1e3", "10001", "99999999999999999", ["1", "2"]]) {
    assert.equal(parseStatePage(bad), null);
  }
  assert.equal(statePagePath("kansas", 1), "/card-shows/kansas");
  assert.equal(statePagePath("kansas", 2), "/card-shows/kansas?page=2");
  const state = US_STATES.find(state => state.code === "KS")!;
  assert.notEqual(getStateSeo(state).description, getStateSeo(state, 2).description);
  assert.match(getStateSeo(state, 2).title, /Page 2/);
});

test("calendar and sitemap retain ongoing shows and exclude ended or expired events", () => {
  const now = new Date("2026-11-21T17:00:00Z");
  const ongoing = { status: "APPROVED", endDate: new Date("2026-11-22T00:00:00Z"), expiresAt: null };
  assert.equal(isUpcomingCalendarShow(ongoing, now), true);
  assert.equal(isUpcomingCalendarShow({ ...ongoing, endDate: new Date("2026-11-21T00:00:00Z") }, now), true);
  assert.equal(isUpcomingCalendarShow({ ...ongoing, endDate: new Date("2026-11-20T00:00:00Z") }, now), false);
  assert.equal(isUpcomingCalendarShow({ ...ongoing, expiresAt: new Date("2026-11-20T23:59:59Z") }, now), false);
  assert.equal(isUpcomingCalendarShow({ ...ongoing, status: "PENDING" }, now), false);
  assert.equal(isUpcomingCalendarShow({ ...ongoing, status: "REJECTED" }, now), false);
  assert.equal(upcomingShowWhere(now).endDate.gte.toISOString(), "2026-11-21T00:00:00.000Z");
});
