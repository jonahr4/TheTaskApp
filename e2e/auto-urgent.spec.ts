import { test, expect } from "@playwright/test";
import {
  uniqueTitle,
  datePlusDays,
  taskRow,
  createTask,
  cleanupTasks,
} from "./helpers";

/**
 * Auto-urgent: a task with an auto-urgent window whose trigger date has
 * passed must be flipped to urgent by the app (visible as the "Do First"
 * badge). The hook runs on mount and whenever tasks change, so creating the
 * task is enough to trigger it — no waiting on the 5-minute timer.
 */
test.describe("auto-urgent", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    await page.goto("/tasks");
    await cleanupTasks(page, created.splice(0));
  });

  test("marks a task urgent once its trigger date passes", async ({ page }) => {
    const title = uniqueTitle("e2e auto-urgent");
    await page.goto("/tasks");
    // Due tomorrow with "1 day before": the trigger date is today.
    await createTask(page, {
      title,
      dueDate: datePlusDays(1),
      priority: "Schedule",
      autoUrgent: "1",
    });
    created.push(title);

    const row = taskRow(page, title);
    await expect(row.getByText("Do First", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("does not mark a task urgent before its trigger date", async ({ page }) => {
    const title = uniqueTitle("e2e auto-urgent future");
    await page.goto("/tasks");
    // Due in 30 days with "1 day before": trigger is 29 days out.
    await createTask(page, {
      title,
      dueDate: datePlusDays(30),
      priority: "Schedule",
      autoUrgent: "1",
    });
    created.push(title);

    const row = taskRow(page, title);
    await expect(row).toBeVisible();
    await expect(
      row.getByText("Do First", { exact: true })
    ).toHaveCount(0, { timeout: 5_000 });
    // ...but the Schedule badge it was created with is still there.
    await expect(row.getByText("Schedule", { exact: true })).toBeVisible();
  });

  test("custom auto-urgent window is respected", async ({ page }) => {
    const title = uniqueTitle("e2e auto-urgent custom");
    await page.goto("/tasks");
    // Due in 2 days with a custom 3-day window: trigger date is yesterday.
    await createTask(page, {
      title,
      dueDate: datePlusDays(2),
      priority: "Schedule",
      autoUrgent: "custom",
      customDays: "3",
    });
    created.push(title);

    const row = taskRow(page, title);
    await expect(row.getByText("Do First", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });
});
