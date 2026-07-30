import { expect, test } from "@playwright/test";

const optionalScripts = [
  'script[src*="googletagmanager.com"]',
  'script[src*="googlesyndication.com"]',
  'script[src*="connect.facebook.net"]',
].join(",");

test("optional tracking stays disabled before consent and after essential-only", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");

  await expect(page.getByRole("dialog", { name: "Cookie choices" })).toBeVisible();
  await expect(page.locator(optionalScripts)).toHaveCount(0);

  await page.getByRole("button", { name: "Essential only" }).click();
  await expect(page.getByRole("dialog", { name: "Cookie choices" })).toBeHidden();

  const consentCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "csn_cookie_consent",
  );
  expect(consentCookie?.value).toBe("essential");

  await page.reload();
  await expect(page.locator(optionalScripts)).toHaveCount(0);
});
