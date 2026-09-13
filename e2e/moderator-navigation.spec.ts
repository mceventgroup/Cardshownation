import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const javaScriptEnabled of [true, false]) {
  test.describe(`moderator mobile navigation with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, () => {
    test.use({ javaScriptEnabled });

    test("main website is reachable without opening the menu", async ({ page }) => {
      // The login page shares the dashboard's moderator layout and needs no
      // live account or database fixture to exercise the mobile header.
      await page.goto("/moderator/login");
      const header = page.locator("header");
      await expect(header.locator("details")).not.toHaveAttribute("open");

      const mainWebsite = header.getByRole("link", { name: "Main website", exact: true });
      await expect(mainWebsite).toBeVisible();
      await mainWebsite.tap();

      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "Find card shows near you." })).toBeVisible();
    });
  });
}
