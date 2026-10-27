import { test, expect } from "./fixtures";
import { uniqueTitle } from "./helpers";
import { GroupsPage } from "./pages/GroupsPage";

/**
 * Task lists (groups): create a list, assign a task to it, and see the
 * task rendered under that list's card.
 */
test.describe("groups", () => {
  const createdTasks: string[] = [];
  const createdLists: string[] = [];

  test.afterEach(async ({ page }) => {
    const groups = new GroupsPage(page);
    await groups.goto();
    await groups.tasks.cleanup(createdTasks.splice(0));
    for (const name of createdLists.splice(0)) {
      await groups.deleteList(name);
    }
  });

  test("creates a list and assigns a task to it", async ({ page }) => {
    const listName = uniqueTitle("e2e list");
    const title = uniqueTitle("e2e grouped task");
    const groups = new GroupsPage(page);
    await groups.goto();

    await groups.createList(listName);
    await expect(groups.listHeading(listName)).toBeVisible();
    createdLists.push(listName);

    await groups.tasks.create({ title, list: listName });
    createdTasks.push(title);

    await expect(groups.taskInList(listName, title)).toBeVisible();
  });
});
