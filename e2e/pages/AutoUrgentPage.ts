import { Page } from "@playwright/test";
import { TasksPage, type CreateTaskOptions } from "./TasksPage";

/** Auto-urgent is asserted on the tasks list, via the priority badge. */
export class AutoUrgentPage {
  readonly tasks: TasksPage;

  constructor(page: Page) {
    this.tasks = new TasksPage(page);
  }

  async goto() {
    await this.tasks.goto();
  }

  async create(opts: CreateTaskOptions) {
    await this.tasks.create(opts);
  }

  row(title: string) {
    return this.tasks.taskRow(title);
  }

  badge(title: string, name: "DO" | "SCHEDULE") {
    return this.tasks.badge(title, name);
  }
}
