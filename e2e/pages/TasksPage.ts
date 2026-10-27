import { expect, Page } from "@playwright/test";
import { modalByHeading } from "./modal";

export type PriorityName = "Do First" | "Schedule" | "Delegate" | "Eliminate";

export interface CreateTaskOptions {
  title: string;
  notes?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: PriorityName;
  /** "1" | "2" | "7" = N days/week before; "custom" needs customDays */
  autoUrgent?: "1" | "2" | "7" | "custom";
  customDays?: string;
  list?: string;
}

export class TasksPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/tasks");
  }

  allTasksHeading() {
    return this.page.getByRole("heading", { name: "All Tasks" });
  }

  /**
   * Task row. @hello-pangea/dnd marks it with data-rfd-draggable-id.
   * Match the title text exactly so "buy milk" does not also match "buy milk edited".
   */
  taskRow(title: string) {
    return this.page.locator("[data-rfd-draggable-id]").filter({
      has: this.page.getByText(title, { exact: true }),
    });
  }

  badge(title: string, name: string) {
    return this.taskRow(title).getByText(name, { exact: true });
  }

  titleText(title: string) {
    return this.taskRow(title).getByText(title, { exact: true });
  }

  private newTaskModal() {
    return modalByHeading(this.page, "New Task", "Create task");
  }

  private editTaskModal() {
    return modalByHeading(this.page, "Edit Task", "Save changes");
  }

  async create(opts: CreateTaskOptions) {
    await this.page.getByRole("button", { name: "Add task" }).click();
    const modal = this.newTaskModal();
    await expect(modal).toBeVisible();

    await modal.getByPlaceholder("What needs to be done?").fill(opts.title);
    if (opts.notes) await modal.getByPlaceholder("Add details...").fill(opts.notes);
    if (opts.dueDate) {
      const date = modal.locator('input[type="date"]');
      await date.fill(opts.dueDate);
      await date.blur();
    }
    if (opts.dueTime) {
      const time = modal.locator('input[type="time"]');
      await time.fill(opts.dueTime);
      await time.blur();
    }
    if (opts.priority) {
      await modal.getByRole("button", { name: opts.priority, exact: true }).click();
    }
    if (opts.autoUrgent) {
      const select = modal.locator("select", { has: this.page.locator('option[value="custom"]') });
      await select.selectOption(opts.autoUrgent);
      if (opts.autoUrgent === "custom" && opts.customDays) {
        await modal.getByPlaceholder("Days").fill(opts.customDays);
      }
    }
    if (opts.list) {
      // The first <select> is the phone-only priority picker (sm:hidden).
      // The visible list picker is the one that offers General Tasks.
      const listSelect = modal.locator("select:visible").filter({
        has: this.page.locator("option", { hasText: "General Tasks" }),
      });
      await listSelect.selectOption({ label: opts.list });
    }

    await modal.getByRole("button", { name: "Create task" }).click();
    await expect(this.taskRow(opts.title)).toBeVisible();
  }

  async openNewTask() {
    await this.page.getByRole("button", { name: "Add task" }).click();
  }

  createTaskButton() {
    return this.newTaskModal().getByRole("button", { name: "Create task" });
  }

  async cancelNewTask() {
    await this.newTaskModal().getByRole("button", { name: "Cancel" }).click();
  }

  async openTask(title: string) {
    await this.taskRow(title).click();
    await expect(this.editTaskModal()).toBeVisible();
  }

  async replaceTitle(next: string) {
    await this.editTaskModal().getByPlaceholder("What needs to be done?").fill(next);
  }

  async saveEdits() {
    await this.editTaskModal().getByRole("button", { name: "Save changes" }).click();
  }

  async toggleComplete(title: string) {
    // The drag handle is also a button and comes first. The round checkbox is the complete control.
    await this.taskRow(title).locator("button.rounded-full").click();
  }

  async delete(title: string) {
    const row = this.taskRow(title);
    await row.hover();
    await row.getByRole("button").last().click({ force: true });
    await this.page.getByText("Delete", { exact: true }).last().click();
    await expect(row).toHaveCount(0);
  }

  async cleanup(titles: string[]) {
    for (const title of titles) {
      const row = this.taskRow(title);
      if ((await row.count()) > 0) {
        try {
          await this.delete(title);
        } catch {
          // Task cleanup is best-effort. Account deletion is what must succeed.
        }
      }
    }
  }

  async signOut() {
    await this.page.getByRole("banner").getByRole("button").first().click();
    await this.page.getByRole("button", { name: "Sign out" }).click();
    await this.page.waitForURL("**/login");
  }
}
