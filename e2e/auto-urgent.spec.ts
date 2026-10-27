import { test, expect } from "./fixtures";
import { datePlusDays, uniqueTitle } from "./helpers";
import { AutoUrgentPage } from "./pages/AutoUrgentPage";

/**
 * Auto-urgent: a task with an auto-urgent window whose trigger date has
 * passed must be flipped to urgent by the app (visible as the "DO"
 * badge). The hook runs on mount and whenever tasks change, so creating the
 * task is enough to trigger it — no waiting on the 5-minute timer.
 */
test.describe("auto-urgent", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    const tasks = new AutoUrgentPage(page).tasks;
    await tasks.goto();
    await tasks.cleanup(created.splice(0));
  });

  test("marks a task urgent once its trigger date passes", async ({ page }) => {
    const title = uniqueTitle("e2e auto-urgent");
    const autoUrgent = new AutoUrgentPage(page);
    await autoUrgent.goto();
    // Due tomorrow with "1 day before": the trigger date is today.
    await autoUrgent.create({
      title,
      dueDate: datePlusDays(1),
      priority: "Schedule",
      autoUrgent: "1",
    });
    created.push(title);

    await expect(autoUrgent.badge(title, "DO")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("does not mark a task urgent before its trigger date", async ({ page }) => {
    const title = uniqueTitle("e2e auto-urgent future");
    const autoUrgent = new AutoUrgentPage(page);
    await autoUrgent.goto();
    // Due in 30 days with "1 day before": trigger is 29 days out.
    await autoUrgent.create({
      title,
      dueDate: datePlusDays(30),
      priority: "Schedule",
      autoUrgent: "1",
    });
    created.push(title);

    await expect(autoUrgent.row(title)).toBeVisible();
    await expect(autoUrgent.badge(title, "DO")).toHaveCount(0, { timeout: 5_000 });
    await expect(autoUrgent.badge(title, "SCHEDULE")).toBeVisible();
  });

  test("custom auto-urgent window is respected", async ({ page }) => {
    const title = uniqueTitle("e2e auto-urgent custom");
    const autoUrgent = new AutoUrgentPage(page);
    await autoUrgent.goto();
    // Due in 2 days with a custom 3-day window: trigger date is yesterday.
    await autoUrgent.create({
      title,
      dueDate: datePlusDays(2),
      priority: "Schedule",
      autoUrgent: "custom",
      customDays: "3",
    });
    created.push(title);

    await expect(autoUrgent.badge(title, "DO")).toBeVisible({
      timeout: 30_000,
    });
  });
});
