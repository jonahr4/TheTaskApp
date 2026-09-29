import { test as setup } from "@playwright/test";
import { signIn } from "./helpers";

const authFile = "e2e/.auth/user.json";

/**
 * One-time login as the dummy E2E account. The storage state is reused by
 * every spec so each test starts authenticated.
 */
setup("authenticate as dummy E2E user", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set (see e2e/README.md). " +
        "Use the dedicated dummy account, never a personal one."
    );
  }
  await signIn(page, email, password);
  await page.context().storageState({ path: authFile });
});
