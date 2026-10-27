import { Page } from "@playwright/test";
import { modalByHeading } from "./modal";

export class CalendarPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.getByRole("link", { name: "Calendar", exact: true }).click();
    await this.page.waitForURL("**/calendar");
  }

  event(title: string) {
    return this.page.locator(".fc-event").filter({ hasText: title });
  }

  editTaskModal() {
    return modalByHeading(this.page, "Edit Task", "Save changes");
  }
}
