import { expect, test } from "@playwright/test";

const optionalScripts = [
  'script[src*="googletagmanager.com"]',
  'script[src*="googlesyndication.com"]',
  'script[src*="connect.facebook.net"]',
].join(",");

test("optional tracking stays disabled before consent and after essential-only", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");

  await expect(page.getByRole("dialog", { name: "Your privacy choices" })).toBeVisible();
  await expect(page.locator(optionalScripts)).toHaveCount(0);

  await page.getByRole("button", { name: "Essential only" }).click();
  await expect(page.getByRole("dialog", { name: "Your privacy choices" })).toBeHidden();

  const consentCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "csn_cookie_consent",
  );
  expect(consentCookie?.value).toBe("essential");

  await page.reload();
  await expect(page.locator(optionalScripts)).toHaveCount(0);
});

test("Global Privacy Control overrides an earlier optional-cookie choice", async ({ page, context }) => {
  await context.addCookies([{
    name: "csn_cookie_consent",
    value: "optional",
    url: "http://127.0.0.1:3100",
  }]);
  await page.setExtraHTTPHeaders({ "Sec-GPC": "1" });
  await page.goto("/");

  await expect(page.locator(optionalScripts)).toHaveCount(0);
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(page.getByRole("status")).toContainText("Global Privacy Control is active");
  await expect(page.getByRole("button", { name: "Allow analytics" })).toBeDisabled();
});

test("switching back to essential-only unloads optional tracking", async ({ page, context }) => {
  await context.addCookies([{
    name: "csn_cookie_consent",
    value: "optional",
    url: "http://127.0.0.1:3100",
  }]);
  await page.goto("/");
  await expect(page.locator(optionalScripts)).not.toHaveCount(0);

  await page.getByRole("button", { name: "Cookie settings" }).click();
  await Promise.all([
    page.waitForNavigation(),
    page.getByRole("button", { name: "Essential only" }).click(),
  ]);

  await expect(page.locator(optionalScripts)).toHaveCount(0);
  const consentCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "csn_cookie_consent",
  );
  expect(consentCookie?.value).toBe("essential");
});
