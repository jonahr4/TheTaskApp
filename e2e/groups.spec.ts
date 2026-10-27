import { test, expect } from "./fixtures";
import {
  uniqueTitle,
  modalByHeading,
  createTask,
  cleanupTasks,
} from "./helpers";

/**
 * Task lists (groups): create a list, assign a task to it, and see the
 * task rendered under that list's card.
 */
test.describe("groups", () => {
  const createdTasks: string[] = [];
  const createdLists: string[] = [];

  /** The list card: innermost div holding both the list heading and task rows. */
  function listCard(page: Parameters<typeof createTask>[0], name: string) {
    return page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .filter({ has: page.locator("[data-rbd-draggable-id]") })
      .last();
  }

  test.afterEach(async ({ page }) => {
    await page.goto("/tasks");
    await cleanupTasks(page, createdTasks.splice(0));
    // Lists are timestamped; remove them via the card menu (best-effort).
    for (const name of createdLists.splice(0)) {
      const card = listCard(page, name);
      if ((await card.count()) > 0) {
        try {
          await card.getByRole("button").last().click();
          const editModal = modalByHeading(page, "Edit List", "Save");
          const del = editModal.getByRole("button", { name: "Delete" });
          if ((await del.count()) > 0) await del.click();
        } catch {
          // Cleanup must never fail the suite.
        }
      }
    }
  });

  test("creates a list and assigns a task to it", async ({ page }) => {
    const listName = uniqueTitle("e2e list");
    const title = uniqueTitle("e2e grouped task");
    await page.goto("/tasks");

    await page.getByRole("button", { name: "New list" }).click();
    const listModal = modalByHeading(page, "New List", "Create list");
    await listModal.getByPlaceholder("e.g. Work, Personal, CS 505").fill(listName);
    await listModal.getByRole("button", { name: "Create list" }).click();
    await expect(
      page.getByRole("heading", { name: listName, exact: true })
    ).toBeVisible();
    createdLists.push(listName);

    await createTask(page, { title, list: listName });
    createdTasks.push(title);

    const card = listCard(page, listName);
    await expect(
      card.locator("[data-rbd-draggable-id]").filter({ hasText: title })
    ).toBeVisible();
  });
});
