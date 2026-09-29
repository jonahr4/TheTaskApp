import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E suite for TheTaskApp web.
 *
 * Runs against a local dev server by default (`npm run dev` is started
 * automatically). Point at a preview/production deployment instead with:
 *
 *   PLAYWRIGHT_BASE_URL=https://the-task-app.vercel.app npx playwright test
 *
 * Auth uses a dedicated dummy Firebase account (never a personal account):
 *
 *   E2E_TEST_EMAIL=dummy@example.com E2E_TEST_PASSWORD=...
 *
 * See e2e/README.md for the full setup.
 */
export default defineConfig({
  testDir: "./e2e",
  // One worker: specs share a single dummy account backed by Firestore,
  // so parallel workers would race on the same data.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
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
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
