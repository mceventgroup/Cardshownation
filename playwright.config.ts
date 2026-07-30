import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.E2E_BASE_URL?.trim();
const baseURL = externalBaseUrl || "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/playwright",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "node scripts/start-e2e-server.mjs",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
