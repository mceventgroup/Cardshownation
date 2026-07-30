import { expect, test } from "@playwright/test";

const fanEmail = process.env.E2E_FAN_EMAIL;
const fanPassword = process.env.E2E_FAN_PASSWORD;
const promoterEmail = process.env.E2E_PROMOTER_EMAIL;
const promoterPassword = process.env.E2E_PROMOTER_PASSWORD;
const foreignShowId = process.env.E2E_FOREIGN_SHOW_ID;

test.describe("isolated database beta authentication", () => {
  test("verified member can sign in", async ({ page }) => {
    test.skip(!fanEmail || !fanPassword, "Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD.");

    await page.goto("/login?from=/account");
    await page.getByLabel("Email").fill(fanEmail!);
    await page.getByLabel("Password").fill(fanPassword!);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: /account/i })).toBeVisible();
  });

  test("promoter cannot open another organizer's floor plan", async ({ page }) => {
    test.skip(
      !promoterEmail || !promoterPassword || !foreignShowId,
      "Set promoter credentials and E2E_FOREIGN_SHOW_ID for an unowned show.",
    );

    await page.goto("/login?from=/promoter");
    await page.getByLabel("Email").fill(promoterEmail!);
    await page.getByLabel("Password").fill(promoterPassword!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/promoter$/);

    await page.goto(`/promoter/shows/${encodeURIComponent(foreignShowId!)}/floorplan`);
    await expect(page).not.toHaveURL(
      new RegExp(`/promoter/shows/${foreignShowId}/floorplan$`),
    );
  });
});
