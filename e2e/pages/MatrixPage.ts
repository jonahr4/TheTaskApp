import { Page } from "@playwright/test";
import { modalByHeading } from "./modal";

export type QuadrantId = "SCHEDULE" | "DO";

export class MatrixPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/matrix");
  }

  quadrant(id: QuadrantId) {
    return this.page.locator(`[data-rfd-droppable-id="${id}"]`);
  }

  task(id: QuadrantId, title: string) {
    return this.quadrant(id).locator("[data-rfd-draggable-id]").filter({ hasText: title });
  }

  async setPriority(id: QuadrantId, title: string, priority: "Do First" | "Schedule") {
    await this.task(id, title).click();
    const modal = modalByHeading(this.page, "Edit Task", "Save changes");
    await modal.getByRole("button", { name: priority, exact: true }).click();
    await modal.getByRole("button", { name: "Save changes" }).click();
  }
}
