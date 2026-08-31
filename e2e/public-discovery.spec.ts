import { expect, test } from "@playwright/test";

test("homepage leads collectors into a filtered show search", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Find card shows near you." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming shows" })).toBeVisible();

  await page.getByPlaceholder("City, state, or show name").fill("Omaha");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/\/card-shows\?q=Omaha$/);
  await expect(page.getByRole("heading", { name: "Browse upcoming card shows" }))
    .toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "Search by show, city, venue, or promoter" }))
    .toHaveValue("Omaha");
});

test("public account entry points remain available", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Submit a show free" })).toBeVisible();
});
