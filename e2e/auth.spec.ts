import { test, expect } from "@playwright/test";
import { test as authed } from "./fixtures";
import { LoginPage } from "./pages/LoginPage";
import { TasksPage } from "./pages/TasksPage";

/**
 * Logged-out checks use a blank session. Sign-out creates its own account
 * and the fixture deletes that account afterwards.
 */
test.describe("auth", () => {
  test.describe("logged out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("shows an error for invalid credentials", async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.fill("nobody@example.com", "wrongpassword");
      await login.submitSignIn();
      await expect(login.credentialError()).toBeVisible();
    });

    test("redirects unauthenticated visits to /login", async ({ page }) => {
      await new LoginPage(page).expectTasksRequireLogin();
    });

    test("toggles to account creation mode", async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.openCreateAccount();
      await expect(login.createAccountButton()).toBeVisible();
    });
  });

  authed("signs out back to /login", async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.goto();
    await expect(tasks.allTasksHeading()).toBeVisible();
    await tasks.signOut();
  });
});
