import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E suite for TheTaskApp web.
 *
 * Runs against a local dev server by default (`npm run dev` is started
 * automatically). Point at a preview/production deployment instead with:
 *
 *   PLAYWRIGHT_BASE_URL=https://the-task-app.vercel.app npx playwright test
 *
 * Each test signs up its own Firebase user and deletes that user afterwards.
 * There is no shared account and no saved storage state.
 *
 * See e2e/README.md.
 */
export default defineConfig({
  testDir: "./e2e",
  // Serial workers keep Firebase signup under the auth rate limit.
  // Isolation is still per test, not per worker.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
