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
  await expect(page.getByRole("link", { name: "Submit a show" })).toBeVisible();
});

test("signup keeps email simple and supports searchable state alerts", async ({ page }) => {
  await page.goto("/account/signup");

  await expect(page.getByText("Free during beta")).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirm email")).toHaveCount(0);

  const password = page.getByRole("textbox", { name: "Password", exact: true });
  const confirmPassword = page.getByRole("textbox", { name: "Confirm password" });
  await expect(password).toHaveAttribute("type", "password");
  await expect(confirmPassword).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Show password" }).click();
  await page.getByRole("button", { name: "Show confirm password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(confirmPassword).toHaveAttribute("type", "text");

  await page.getByRole("button", { name: /Select states/ }).click();
  await page.getByPlaceholder("Search states").fill("kansas");
  await page.getByRole("main").getByText("Kansas", { exact: true }).click();
  await page.getByPlaceholder("Search states").fill("missouri");
  await page.getByRole("main").getByText("Missouri", { exact: true }).click();

  await expect(page.getByRole("button", { name: /2 states selected/ })).toBeVisible();
});
