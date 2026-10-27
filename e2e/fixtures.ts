import { test as base, expect } from "@playwright/test";
import { destroyAccount, newAccount, signUp, type Account } from "./helpers";

/**
 * Per-test isolation. The fixture signs up a new Firebase user before the
 * test and, after it, deletes that user and asserts the same credentials
 * can no longer sign in. Tests do not share an account or a saved session.
 */
export const test = base.extend<{ account: Account }>({
  account: [
    async ({ page }, use) => {
      const account = newAccount();
      await signUp(page, account.email, account.password);
      try {
        await use(account);
      } finally {
        await destroyAccount(page, account);
      }
    },
    { auto: true },
  ],
});

export { expect };
