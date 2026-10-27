import { Page } from "@playwright/test";
import { modalByHeading } from "./modal";
import { TasksPage } from "./TasksPage";

export class GroupsPage {
  readonly tasks: TasksPage;

  constructor(private readonly page: Page) {
    this.tasks = new TasksPage(page);
  }

  async goto() {
    await this.tasks.goto();
  }

  /** Innermost div holding both the list heading and its task rows. */
  listCard(name: string) {
    return this.page
      .locator("div")
      .filter({ has: this.page.getByRole("heading", { name, exact: true }) })
      .filter({ has: this.page.locator("[data-rfd-draggable-id]") })
      .last();
  }

  listHeading(name: string) {
    return this.page.getByRole("heading", { name, exact: true });
  }

  taskInList(listName: string, title: string) {
    return this.listCard(listName).locator("[data-rfd-draggable-id]").filter({ hasText: title });
  }

  async createList(name: string) {
    await this.page.getByRole("button", { name: "New list" }).click();
    const modal = modalByHeading(this.page, "New List", "Create list");
    await modal.getByPlaceholder("e.g. Work, Personal, CS 505").fill(name);
    await modal.getByRole("button", { name: "Create list" }).click();
  }

  /** Best-effort. A missing list must not fail the suite. */
  async deleteList(name: string) {
    const card = this.listCard(name);
    if ((await card.count()) === 0) return;
    try {
      await card.getByRole("button").last().click();
      const editModal = modalByHeading(this.page, "Edit List", "Save");
      const del = editModal.getByRole("button", { name: "Delete" });
      if ((await del.count()) > 0) await del.click();
    } catch {
      // Cleanup must never fail the suite.
    }
  }
}
