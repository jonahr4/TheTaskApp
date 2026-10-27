import { expect, Page } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";
import { TasksPage } from "./pages/TasksPage";

/** Unique, collision-free title so specs never fight over the same row. */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

/** YYYY-MM-DD, `days` from today (local time, matching the app's date inputs). */
export function datePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type Account = { email: string; password: string };

/** A brand-new email/password pair. Firebase requires a password of 6+ characters. */
export function newAccount(): Account {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  return {
    email: `e2e.${stamp}@example.com`,
    password: `E2e-${stamp}-Aa1`,
  };
}

/**
 * Delete the Firebase user currently persisted in this browser.
 * The app has no delete-account control, so this calls the Auth REST
 * endpoint with the id token stored by the client SDK.
 */
export async function deleteCurrentAccount(page: Page) {
  await page.evaluate(async () => {
    const unwrap = (value: Record<string, unknown>): Record<string, unknown> => {
      const nested = value.value;
      if (nested && typeof nested === "object" && "stsTokenManager" in nested) {
        return nested as Record<string, unknown>;
      }
      return value;
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("firebaseLocalStorageDb");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    const storeName = "firebaseLocalStorage";
    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      throw new Error("Firebase auth store is missing");
    }
    const entries = await new Promise<{ key: string; value: Record<string, unknown> }[]>(
      (resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const valuesReq = store.getAll();
        const keysReq = store.getAllKeys();
        tx.oncomplete = () => {
          const values = valuesReq.result as Record<string, unknown>[];
          resolve(keysReq.result.map((key, i) => ({ key: String(key), value: values[i] })));
        };
        tx.onerror = () => reject(tx.error);
      }
    );
    db.close();

    const entry = entries.find((e) => e.key.startsWith("firebase:authUser:"));
    if (!entry) throw new Error("No signed-in Firebase user to delete");
    const stored = unwrap(entry.value);
    const fromKey = entry.key.match(/^firebase:authUser:(.+):\[DEFAULT\]$/)?.[1];
    const apiKey = (stored.apiKey as string | undefined) || fromKey;
    const token = (stored.stsTokenManager as { accessToken?: string } | undefined)?.accessToken;
    if (!apiKey || !token) throw new Error("Signed-in user is missing an id token");

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) {
      throw new Error(`Account delete failed (${res.status}): ${await res.text()}`);
    }
  });
}

/** Sign in and assert the account no longer exists. Uses a clean browser context. */
export async function expectAccountRejected(page: Page, email: string, password: string) {
  const browser = page.context().browser();
  if (!browser) throw new Error("Browser is required to verify account deletion");
  const origin = new URL(page.url()).origin;
  const fresh = await browser.newContext({ baseURL: origin });
  const check = await fresh.newPage();
  try {
    const login = new LoginPage(check);
    await login.goto();
    await login.fill(email, password);
    await login.submitSignIn();
    await expect(login.credentialError()).toBeVisible();
  } finally {
    await fresh.close();
  }
}

/** Sign in if this page is logged out, delete the Auth user, then prove sign-in fails. */
export async function destroyAccount(page: Page, account: Account) {
  const tasks = new TasksPage(page);
  const login = new LoginPage(page);
  await tasks.goto();
  await expect(tasks.allTasksHeading().or(login.card())).toBeVisible();
  if (!(await tasks.allTasksHeading().isVisible())) {
    await login.signIn(account.email, account.password);
  }
  await deleteCurrentAccount(page);
  await expectAccountRejected(page, account.email, account.password);
}
