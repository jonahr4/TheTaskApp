import { test, expect } from "@playwright/test";
import {
  uniqueTitle,
  datePlusDays,
  modalByHeading,
  createTask,
  cleanupTasks,
} from "./helpers";

/**
 * Calendar: a task with a due date renders as a FullCalendar event, and
 * clicking the event opens it for editing.
 */
test.describe("calendar", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    await page.goto("/tasks");
    await cleanupTasks(page, created.splice(0));
  });

  test("shows a dated task as a calendar event", async ({ page }) => {
    const title = uniqueTitle("e2e calendar");
    await page.goto("/tasks");
    await createTask(page, { title, dueDate: datePlusDays(2) });
    created.push(title);

    await page.goto("/calendar");
    const event = page.locator(".fc-event").filter({ hasText: title });
    await expect(event.first()).toBeVisible({ timeout: 30_000 });

    await event.first().click();
    await expect(modalByHeading(page, "Edit Task", "Save changes")).toBeVisible();
  });
});
