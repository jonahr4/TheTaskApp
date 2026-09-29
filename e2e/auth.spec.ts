import { test, expect } from "@playwright/test";

/**
 * Auth flows. The happy-path login is covered by e2e/auth.setup.ts
 * (every other spec starts from that authenticated state).
 */
test.describe("auth", () => {
  test.describe("logged out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("shows an error for invalid credentials", async ({ page }) => {
      await page.goto("/login");
      const card = page.locator("#auth");
      await card.getByPlaceholder("Email").fill("nobody@example.com");
      await card.getByPlaceholder("Password").fill("wrongpassword");
      await card.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(card.getByText("Invalid email or password.")).toBeVisible();
    });

    test("redirects unauthenticated visits to /login", async ({ page }) => {
      await page.goto("/tasks");
      await page.waitForURL("**/login");
    });

    test("toggles to account creation mode", async ({ page }) => {
      await page.goto("/login");
      const card = page.locator("#auth");
      await card.getByRole("button", { name: "No account? Create one" }).click();
      await expect(
        card.getByRole("button", { name: "Create account", exact: true })
      ).toBeVisible();
    });
  });

  test("signs out back to /login", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "All Tasks" })).toBeVisible();
    // User menu trigger lives in the top banner.
    await page.getByRole("banner").getByRole("button").first().click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/login");
  });
});
