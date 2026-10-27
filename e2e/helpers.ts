import { Page, expect } from "@playwright/test";

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

/**
 * Scope to a modal's root panel. The app renders modals as conditional
 * DOM (no portals, no role="dialog"), so we find the innermost div that
 * contains BOTH the modal heading and its save button — that div spans
 * the whole modal panel.
 */
export function modalByHeading(page: Page, heading: string, saveName: string) {
  return page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: heading, exact: true }) })
    .filter({ has: page.getByRole("button", { name: saveName, exact: true }) })
    .last();
}

/** A task row on /tasks, located by its unique title. */
export function taskRow(page: Page, title: string) {
  return page.locator('[data-rfd-draggable-id]').filter({ hasText: title });
}

export type PriorityName = "Do First" | "Schedule" | "Delegate" | "Eliminate";

export interface CreateTaskOptions {
  title: string;
  notes?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  priority?: PriorityName;
  /** "1" | "2" | "7" = N days/week before; "custom" needs customDays */
  autoUrgent?: "1" | "2" | "7" | "custom";
  customDays?: string;
  list?: string;
}

/** Create a task through the New Task modal. Assumes we are on /tasks. */
export async function createTask(page: Page, opts: CreateTaskOptions) {
  await page.getByRole("button", { name: "Add task" }).click();
  const modal = modalByHeading(page, "New Task", "Create task");
  await expect(modal).toBeVisible();

  await modal.getByPlaceholder("What needs to be done?").fill(opts.title);
  if (opts.notes) await modal.getByPlaceholder("Add details...").fill(opts.notes);
  if (opts.dueDate) await modal.locator('input[type="date"]').fill(opts.dueDate);
  if (opts.dueTime) await modal.locator('input[type="time"]').fill(opts.dueTime);
  if (opts.priority) {
    await modal.getByRole("button", { name: opts.priority, exact: true }).click();
  }
  if (opts.autoUrgent) {
    // The Auto-urgent select only renders once a due date is set; it is the
    // select that carries the "custom" option.
    const select = modal.locator("select", { has: page.locator('option[value="custom"]') });
    await select.selectOption(opts.autoUrgent);
    if (opts.autoUrgent === "custom" && opts.customDays) {
      await modal.getByPlaceholder("Days").fill(opts.customDays);
    }
  }
  if (opts.list) {
    const listSelect = modal.locator("select").first();
    await listSelect.selectOption({ label: opts.list });
  }

  await modal.getByRole("button", { name: "Create task" }).click();
  await expect(taskRow(page, opts.title)).toBeVisible();
}

/** Toggle a task's completed checkbox via its row. */
export async function toggleComplete(page: Page, title: string) {
  const row = taskRow(page, title);
  await row.getByRole("button").first().click();
}

/** Delete a task via the hover-revealed row menu. */
export async function deleteTask(page: Page, title: string) {
  const row = taskRow(page, title);
  await row.hover();
  // The ⋯ trigger is icon-only; force the click since it is hover-revealed.
  await row.getByRole("button").last().click({ force: true });
  await page.getByText("Delete", { exact: true }).last().click();
  await expect(row).toHaveCount(0);
}

/**
 * Best-effort cleanup for titles created by a spec. Runs even if the test
 * failed. The account fixture still deletes the user afterwards.
 */
export async function cleanupTasks(page: Page, titles: string[]) {
  for (const title of titles) {
    const row = taskRow(page, title);
    if ((await row.count()) > 0) {
      try {
        await deleteTask(page, title);
      } catch {
        // Task cleanup is best-effort. Account deletion is what must succeed.
      }
    }
  }
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

/** Create an account through the login page signup form and land on /tasks. */
export async function signUp(page: Page, email: string, password: string) {
  await page.goto("/login");
  const card = page.locator("#auth");
  await card.getByRole("button", { name: "No account? Create one" }).click();
  await card.getByPlaceholder("Email").fill(email);
  await card.getByPlaceholder("Password").fill(password);
  await card.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Tasks" })).toBeVisible();
  await page.waitForURL("**/tasks");
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
  const fresh = await browser.newContext();
  const check = await fresh.newPage();
  try {
    await check.goto(`${origin}/login`);
    const card = check.locator("#auth");
    await card.getByPlaceholder("Email").fill(email);
    await card.getByPlaceholder("Password").fill(password);
    await card.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(card.getByText("Invalid email or password.")).toBeVisible();
  } finally {
    await fresh.close();
  }
}

/** Sign in if this page is logged out, delete the Auth user, then prove sign-in fails. */
export async function destroyAccount(page: Page, account: Account) {
  await page.goto("/tasks");
  const tasksHeading = page.getByRole("heading", { name: "All Tasks" });
  const loginCard = page.locator("#auth");
  await expect(tasksHeading.or(loginCard)).toBeVisible();
  if (!(await tasksHeading.isVisible())) {
    await signIn(page, account.email, account.password);
  }
  await deleteCurrentAccount(page);
  await expectAccountRejected(page, account.email, account.password);
}

/** Sign in through the UI. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  const card = page.locator("#auth");
  await card.getByPlaceholder("Email").fill(email);
  await card.getByPlaceholder("Password").fill(password);
  await card.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Tasks" })).toBeVisible();
  await page.waitForURL("**/tasks");
}
