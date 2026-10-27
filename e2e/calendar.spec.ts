import { test, expect } from "./fixtures";
import { datePlusDays, uniqueTitle } from "./helpers";
import { CalendarPage } from "./pages/CalendarPage";
import { TasksPage } from "./pages/TasksPage";

/**
 * Calendar: a task with a due date renders as a FullCalendar event, and
 * clicking the event opens it for editing.
 */
test.describe("calendar", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.cleanup(created.splice(0));
  });

  test("shows a dated task as a calendar event", async ({ page }) => {
    const title = uniqueTitle("e2e calendar");
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.create({ title, dueDate: datePlusDays(2) });
    created.push(title);

    const calendar = new CalendarPage(page);
    await calendar.goto();
    await expect(calendar.event(title).first()).toBeVisible({ timeout: 30_000 });

    await calendar.event(title).first().click();
    await expect(calendar.editTaskModal()).toBeVisible();
  });
});
