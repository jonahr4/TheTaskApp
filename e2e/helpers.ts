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
  return page.locator('[data-rbd-draggable-id]').filter({ hasText: title });
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
 * failed, so the dummy account stays tidy.
 */
export async function cleanupTasks(page: Page, titles: string[]) {
  for (const title of titles) {
    const row = taskRow(page, title);
    if ((await row.count()) > 0) {
      try {
        await deleteTask(page, title);
      } catch {
        // Cleanup must never fail the suite; the dummy account is throwaway.
      }
    }
  }
}

/** Sign in through the UI (used by the auth setup project). */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  const card = page.locator("#auth");
  await card.getByPlaceholder("Email").fill(email);
  await card.getByPlaceholder("Password").fill(password);
  await card.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All Tasks" })).toBeVisible();
  await page.waitForURL("**/tasks");
}
