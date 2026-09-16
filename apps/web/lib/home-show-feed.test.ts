import assert from "node:assert/strict";
import test from "node:test";
import { getHomeShowFeed } from "@/lib/home-show-feed";

function locationHeaders() {
  return new Headers({
    "x-vercel-ip-country": "US",
    "x-vercel-ip-country-region": "MO",
    "x-vercel-ip-city": "Kansas%20City",
    "x-vercel-ip-latitude": "39.0997",
    "x-vercel-ip-longitude": "-94.5786",
  });
}

test("saved state overrides IP location", async () => {
  const feed = await getHomeShowFeed(locationHeaders(), "CO", {
    upcoming: async (options) => {
      assert.deepEqual(options, { state: "CO", limit: 8 });
      return { shows: [] };
    },
    nearby: async () => { throw new Error("Must not override the saved state"); },
  });
  assert.equal(feed.title, "Upcoming shows in Colorado");
  assert.equal(feed.href, "/card-shows/colorado");
});

test("new visitors get an IP radius search across state borders without national filler", async () => {
  const feed = await getHomeShowFeed(locationHeaders(), undefined, {
    upcoming: async () => { throw new Error("Must not use nationwide shows"); },
    nearby: async (options) => {
      assert.equal(options.lat, 39.0997);
      assert.equal(options.lng, -94.5786);
      assert.equal(options.radiusMiles, 100);
      assert.equal(options.limit, 8);
      return [];
    },
  });
  assert.equal(feed.title, "Upcoming shows near Kansas City, MO");
  assert.match(feed.emptyMessage, /within 100 miles/);
  assert.deepEqual(feed.shows, []);
});

test("missing coordinates fall back to a detected US state", async () => {
  const headers = locationHeaders();
  headers.delete("x-vercel-ip-latitude");
  await getHomeShowFeed(headers, undefined, {
    upcoming: async (options) => {
      assert.deepEqual(options, { state: "MO", limit: 8 });
      return { shows: [] };
    },
    nearby: async () => { throw new Error("Coordinates unavailable"); },
  });
});

test("unavailable location and invalid preferences use an explicitly nationwide feed", async () => {
  const feed = await getHomeShowFeed(new Headers(), "XX", {
    upcoming: async (options) => {
      assert.deepEqual(options, { limit: 8 });
      return { shows: [] };
    },
    nearby: async () => { throw new Error("Coordinates unavailable"); },
  });
  assert.match(feed.description, /nationwide/);
});

test("foreign regions are not mistaken for US states", async () => {
  await getHomeShowFeed(new Headers({
    "x-vercel-ip-country": "CA", "x-vercel-ip-country-region": "AB",
  }), undefined, {
    upcoming: async (options) => {
      assert.deepEqual(options, { limit: 8 });
      return { shows: [] };
    },
    nearby: async () => { throw new Error("Coordinates unavailable"); },
  });
});
