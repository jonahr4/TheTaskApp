import { test, expect } from "./fixtures";
import { datePlusDays, uniqueTitle } from "./helpers";
import { TasksPage } from "./pages/TasksPage";

/**
 * Core task lifecycle on /tasks. Every test creates uniquely-titled tasks
 * and removes them afterwards. The account fixture then deletes the user.
 */
test.describe("tasks", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.cleanup(created.splice(0));
  });

  test("creates a task with just a title", async ({ page }) => {
    const title = uniqueTitle("e2e basic");
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.create({ title });
    created.push(title);
    await expect(tasks.taskRow(title)).toBeVisible();
  });

  test("creates a task with all fields", async ({ page }) => {
    const title = uniqueTitle("e2e full");
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.create({
      title,
      notes: "e2e notes",
      dueDate: datePlusDays(7),
      dueTime: "14:30",
      priority: "Schedule",
    });
    created.push(title);
    await expect(tasks.taskRow(title)).toBeVisible();
    await expect(tasks.badge(title, "SCHEDULE")).toBeVisible();
  });

  test("edits a task title", async ({ page }) => {
    const title = uniqueTitle("e2e edit");
    const edited = `${title} edited`;
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.create({ title });
    created.push(edited);

    await tasks.openTask(title);
    await tasks.replaceTitle(edited);
    await tasks.saveEdits();

    await expect(tasks.taskRow(edited)).toBeVisible();
    await expect(tasks.taskRow(title)).toHaveCount(0);
  });

  test("completes and uncompletes a task", async ({ page }) => {
    const title = uniqueTitle("e2e complete");
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.create({ title });
    created.push(title);

    await tasks.toggleComplete(title);
    await expect(tasks.titleText(title)).toHaveClass(/line-through/);

    await tasks.toggleComplete(title);
    await expect(tasks.titleText(title)).not.toHaveClass(/line-through/);
  });

  test("deletes a task", async ({ page }) => {
    const title = uniqueTitle("e2e delete");
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.create({ title });
    await tasks.delete(title);
  });

  test("requires a title before saving", async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.openNewTask();
    await expect(tasks.createTaskButton()).toBeDisabled();
    await tasks.cancelNewTask();
  });
});
