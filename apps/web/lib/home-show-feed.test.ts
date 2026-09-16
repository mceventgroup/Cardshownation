import assert from "node:assert/strict";
import test from "node:test";
import { getHomeShowFeed } from "@/lib/home-show-feed";
import { getRequestState } from "@/lib/ip-state";
import type { ShowCard } from "@/types";

const omahaHeaders = new Headers({
  "x-vercel-forwarded-for": "198.51.100.19",
  "x-vercel-ip-country": "US",
  "x-vercel-ip-country-region": "NE",
  "x-vercel-ip-city": "Omaha",
  "x-vercel-ip-latitude": "41.2565",
  "x-vercel-ip-longitude": "-95.9345",
});

test("an explicit state URL overrides IP location and skips the external lookup", async () => {
  const feed = await getHomeShowFeed(omahaHeaders, "KS", {
    upcoming: async (options) => {
      assert.deepEqual(options, { state: "CO", limit: 8 });
      return { shows: [] };
    },
    detectState: async () => { throw new Error("Must skip lookup for explicit state"); },
  }, "CO");
  assert.equal(feed.title, "Upcoming shows in Colorado");
  assert.equal(feed.href, "/card-shows/colorado");
});

test("a New York visitor is not pinned to a saved Kansas state", async () => {
  const feed = await getHomeShowFeed(new Headers({
    "x-vercel-forwarded-for": "172.68.88.196", "cf-connecting-ip": "198.51.100.20",
    "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "NE",
  }), "KS", {
    detectState: (headers) => getRequestState(headers, async (ip) => {
      assert.equal(ip, "198.51.100.20");
      return "NY";
    }),
    upcoming: async (options) => {
      assert.deepEqual(options, { state: "NY", limit: 8 });
      return { shows: [] };
    },
  });
  assert.equal(feed.title, "Upcoming shows in New York");
  assert.match(feed.description, /approximate internet location/);
});

test("a saved state is used only when automatic detection is unavailable", async () => {
  const feed = await getHomeShowFeed(new Headers(), "KS", {
    detectState: async () => null,
    upcoming: async ({ state }) => {
      assert.equal(state, "KS");
      return { shows: [] };
    },
  });
  assert.match(feed.description, /could not estimate/);
  assert.equal(feed.title, "Upcoming shows in Kansas");
});

test("Kansas detection overrides Omaha headers and includes Wichita without a radius cutoff", async () => {
  const wichita: ShowCard = {
    id: "wichita", title: "Wichita show", slug: "wichita-show", city: "Wichita", state: "KS",
    startDate: new Date("2030-01-01"), endDate: new Date("2030-01-01"),
    startTimeLabel: null, endTimeLabel: null, isFree: true, admissionPrice: null,
    categories: [], flyerImageUrl: null, tableCount: null, vendorDetails: null,
    featuredRank: null, venue: null,
  };
  const feed = await getHomeShowFeed(omahaHeaders, undefined, {
    detectState: (headers) => getRequestState(headers, async () => "KS"),
    upcoming: async (options) => {
      assert.deepEqual(options, { state: "KS", limit: 8 });
      return { shows: [wichita] };
    },
  });
  assert.equal(feed.title, "Upcoming shows in Kansas");
  assert.deepEqual(feed.shows, [wichita]);
  assert.equal(feed.href, "/card-shows/kansas");
  assert.match(feed.description, /statewide/);
});

test("unavailable location and invalid preferences use an explicitly nationwide feed", async () => {
  const feed = await getHomeShowFeed(new Headers(), "XX", {
    upcoming: async (options) => {
      assert.deepEqual(options, { limit: 8 });
      return { shows: [] };
    },
  });
  assert.match(feed.description, /nationwide/);
});

test("empty state results do not get filled with out-of-state shows", async () => {
  const feed = await getHomeShowFeed(new Headers(), "KS", {
    upcoming: async ({ state }) => {
      assert.equal(state, "KS");
      return { shows: [] };
    },
  });
  assert.deepEqual(feed.shows, []);
  assert.match(feed.emptyMessage, /No upcoming shows listed in Kansas/);
});
