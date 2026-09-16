import { expect, test } from "@playwright/test";

const geoHeaders = {
  "x-vercel-ip-country": "US",
  "x-vercel-ip-country-region": "MO",
  "x-vercel-ip-city": "Kansas%20City",
  "x-vercel-ip-latitude": "39.0997",
  "x-vercel-ip-longitude": "-94.5786",
};

test("homepage follows each request location despite a saved Kansas state", async ({ request }) => {
  const nearby = await request.get("/", { headers: geoHeaders });
  expect(nearby.ok()).toBeTruthy();
  const nearbyHtml = await nearby.text();
  expect(nearbyHtml).toContain("Upcoming shows in Missouri");
  expect(nearbyHtml).toContain("Showing statewide based on your approximate internet location.");

  const preferred = await request.get("/", {
    headers: { ...geoHeaders, "x-vercel-ip-country-region": "NY", Cookie: "csn_preferred_state=KS" },
  });
  expect(preferred.ok()).toBeTruthy();
  expect(await preferred.text()).toContain("Upcoming shows in New York");

  const fallback = await request.get("/", { headers: { Cookie: "csn_preferred_state=KS" } });
  expect(await fallback.text()).toContain("Showing your saved state instead.");

  const nationwide = await request.get("/");
  expect(nationwide.ok()).toBeTruthy();
  const nationwideHtml = await nationwide.text();
  expect(nationwideHtml).toContain("Showing nationwide.");
  expect(nationwideHtml).not.toContain("Upcoming shows in Missouri");
});

test("a visitor can correct an Omaha IP estimate to Kansas and keep it after reloading", async ({ page, context }) => {
  await page.setExtraHTTPHeaders({
    ...geoHeaders,
    "x-vercel-ip-country-region": "NE",
    "x-vercel-ip-city": "Omaha",
    "x-vercel-ip-latitude": "41.2565",
    "x-vercel-ip-longitude": "-95.9345",
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Essential only" }).click();
  await expect(page.getByRole("heading", { name: "Upcoming shows in Nebraska" })).toBeVisible();

  await page.getByLabel("Choose your state").selectOption("KS");
  await page.getByRole("button", { name: "Update shows" }).click();
  await expect(page.getByRole("heading", { name: "Upcoming shows in Kansas" })).toBeVisible();
  await expect(page).toHaveURL(/\/\?state=KS$/);
  expect((await context.cookies()).find((cookie) => cookie.name === "csn_preferred_state")?.value).toBe("KS");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Upcoming shows in Kansas" })).toBeVisible();
  await expect(page.getByLabel("Choose your state")).toHaveValue("KS");

  await page.setExtraHTTPHeaders({ ...geoHeaders, "x-vercel-ip-country-region": "NY" });
  await page.getByLabel("Choose your state").selectOption("");
  await page.getByRole("button", { name: "Update shows" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Upcoming shows in New York" })).toBeVisible();
  await expect(page.getByLabel("Choose your state")).toHaveValue("");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Upcoming shows in New York" })).toBeVisible();
});

test("failed state saves show an error without pretending the location changed", async ({ page }) => {
  await page.setExtraHTTPHeaders(geoHeaders);
  await page.goto("/");
  await page.getByRole("button", { name: "Essential only" }).click();
  await page.route("**/api/preferences/state", (route) => route.fulfill({ status: 500, body: "Unavailable" }));
  await page.getByLabel("Choose your state").selectOption("KS");
  await page.getByRole("button", { name: "Update shows" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your state could not be saved" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming shows in Missouri" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update shows" })).toBeEnabled();
});

test("state preferences still reject cross-origin requests", async ({ request }) => {
  const response = await request.post("/api/preferences/state", {
    headers: { Origin: "https://unrelated.example" },
    data: { state: "KS" },
  });
  expect(response.status()).toBe(403);
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
