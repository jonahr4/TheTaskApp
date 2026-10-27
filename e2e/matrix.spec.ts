import { test, expect } from "./fixtures";
import { uniqueTitle } from "./helpers";
import { MatrixPage } from "./pages/MatrixPage";
import { TasksPage } from "./pages/TasksPage";

/**
 * Eisenhower matrix: tasks land in the quadrant matching their
 * urgent/important combination, and editing priority moves them.
 * Quadrants are located by their hello-pangea droppable ids.
 */
test.describe("matrix", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.cleanup(created.splice(0));
  });

  test("shows a task in its priority quadrant and moves it on edit", async ({
    page,
  }) => {
    const title = uniqueTitle("e2e matrix");
    const tasks = new TasksPage(page);
    await tasks.goto();
    await tasks.create({ title, priority: "Schedule" });
    created.push(title);

    const matrix = new MatrixPage(page);
    await matrix.goto();
    await expect(matrix.task("SCHEDULE", title)).toBeVisible();
    await matrix.setPriority("SCHEDULE", title, "Do First");
    await expect(matrix.task("DO", title)).toBeVisible();
  });
});
