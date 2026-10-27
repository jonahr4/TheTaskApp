import { test, expect } from "./fixtures";
import {
  uniqueTitle,
  modalByHeading,
  createTask,
  cleanupTasks,
} from "./helpers";

/**
 * Eisenhower matrix: tasks land in the quadrant matching their
 * urgent/important combination, and editing priority moves them.
 * Quadrants are located by their hello-pangea droppable ids.
 */
test.describe("matrix", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    await page.goto("/tasks");
    await cleanupTasks(page, created.splice(0));
  });

  test("shows a task in its priority quadrant and moves it on edit", async ({
    page,
  }) => {
    const title = uniqueTitle("e2e matrix");
    await page.goto("/tasks");
    await createTask(page, { title, priority: "Schedule" });
    created.push(title);

    await page.goto("/matrix");
    const scheduleQ = page.locator('[data-rfd-droppable-id="SCHEDULE"]');
    await expect(
      scheduleQ.locator('[data-rfd-draggable-id]').filter({ hasText: title })
    ).toBeVisible();

    // Edit the priority to Do First via the modal and re-check.
    await scheduleQ
      .locator('[data-rfd-draggable-id]')
      .filter({ hasText: title })
      .click();
    const modal = modalByHeading(page, "Edit Task", "Save changes");
    await modal.getByRole("button", { name: "Do First", exact: true }).click();
    await modal.getByRole("button", { name: "Save changes" }).click();

    const doQ = page.locator('[data-rfd-droppable-id="DO"]');
    await expect(
      doQ.locator('[data-rfd-draggable-id]').filter({ hasText: title })
    ).toBeVisible();
  });
});
