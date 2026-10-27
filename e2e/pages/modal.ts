import { Page } from "@playwright/test";

/**
 * The app renders modals as conditional DOM (no portals, no role="dialog").
 * The innermost div that contains both the heading and the save button is the panel.
 */
export function modalByHeading(page: Page, heading: string, saveName: string) {
  return page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: heading, exact: true }) })
    .filter({ has: page.getByRole("button", { name: saveName, exact: true }) })
    .last();
}
