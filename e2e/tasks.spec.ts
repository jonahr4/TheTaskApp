import { test, expect } from "./fixtures";
import {
  uniqueTitle,
  datePlusDays,
  modalByHeading,
  taskRow,
  createTask,
  toggleComplete,
  deleteTask,
  cleanupTasks,
} from "./helpers";

/**
 * Core task lifecycle on /tasks. Every test creates uniquely-titled tasks
 * and removes them afterwards. The account fixture then deletes the user.
 */
test.describe("tasks", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    await page.goto("/tasks");
    await cleanupTasks(page, created.splice(0));
  });

  test("creates a task with just a title", async ({ page }) => {
    const title = uniqueTitle("e2e basic");
    await page.goto("/tasks");
    await createTask(page, { title });
    created.push(title);
    await expect(taskRow(page, title)).toBeVisible();
  });

  test("creates a task with all fields", async ({ page }) => {
    const title = uniqueTitle("e2e full");
    await page.goto("/tasks");
    await createTask(page, {
      title,
      notes: "e2e notes",
      dueDate: datePlusDays(7),
      dueTime: "14:30",
      priority: "Schedule",
    });
    created.push(title);
    const row = taskRow(page, title);
    await expect(row).toBeVisible();
    await expect(row.getByText("Schedule", { exact: true })).toBeVisible();
  });

  test("edits a task title", async ({ page }) => {
    const title = uniqueTitle("e2e edit");
    const edited = `${title} edited`;
    await page.goto("/tasks");
    await createTask(page, { title });
    created.push(edited);

    await taskRow(page, title).click();
    const modal = modalByHeading(page, "Edit Task", "Save changes");
    await expect(modal).toBeVisible();
    await modal.getByPlaceholder("What needs to be done?").fill(edited);
    await modal.getByRole("button", { name: "Save changes" }).click();

    await expect(taskRow(page, edited)).toBeVisible();
    await expect(taskRow(page, title)).toHaveCount(0);
  });

  test("completes and uncompletes a task", async ({ page }) => {
    const title = uniqueTitle("e2e complete");
    await page.goto("/tasks");
    await createTask(page, { title });
    created.push(title);

    await toggleComplete(page, title);
    const row = taskRow(page, title);
    await expect(row.getByText(title)).toHaveClass(/line-through/);

    await toggleComplete(page, title);
    await expect(row.getByText(title)).not.toHaveClass(/line-through/);
  });

  test("deletes a task", async ({ page }) => {
    const title = uniqueTitle("e2e delete");
    await page.goto("/tasks");
    await createTask(page, { title });
    await deleteTask(page, title);
  });

  test("requires a title before saving", async ({ page }) => {
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Add task" }).click();
    const modal = modalByHeading(page, "New Task", "Create task");
    await expect(
      modal.getByRole("button", { name: "Create task" })
    ).toBeDisabled();
    await modal.getByRole("button", { name: "Cancel" }).click();
  });
});
