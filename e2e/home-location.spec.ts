import { expect, test } from "@playwright/test";

const geoHeaders = {
  "x-vercel-ip-country": "US",
  "x-vercel-ip-country-region": "MO",
  "x-vercel-ip-city": "Kansas%20City",
  "x-vercel-ip-latitude": "39.0997",
  "x-vercel-ip-longitude": "-94.5786",
};

test("homepage personalizes each request using IP location or a saved state", async ({ request }) => {
  const nearby = await request.get("/", { headers: geoHeaders });
  expect(nearby.ok()).toBeTruthy();
  const nearbyHtml = await nearby.text();
  expect(nearbyHtml).toContain("Upcoming shows near Kansas City, MO");
  expect(nearbyHtml).toContain("Within 100 miles of your approximate internet location.");

  const preferred = await request.get("/", {
    headers: { ...geoHeaders, Cookie: "csn_preferred_state=CO" },
  });
  expect(preferred.ok()).toBeTruthy();
  expect(await preferred.text()).toContain("Upcoming shows in Colorado");

  const nationwide = await request.get("/");
  expect(nationwide.ok()).toBeTruthy();
  const nationwideHtml = await nationwide.text();
  expect(nationwideHtml).toContain("Showing nationwide.");
  expect(nationwideHtml).not.toContain("Upcoming shows near Kansas City, MO");
});
