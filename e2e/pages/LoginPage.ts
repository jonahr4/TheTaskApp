import { expect, Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  card() {
    return this.page.locator("#auth");
  }

  credentialError() {
    return this.card().getByText("Invalid email or password.");
  }

  createAccountButton() {
    return this.card().getByRole("button", { name: "Create account", exact: true });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async fill(email: string, password: string) {
    const card = this.card();
    await card.getByPlaceholder("Email").fill(email);
    await card.getByPlaceholder("Password").fill(password);
  }

  async submitSignIn() {
    await this.card().getByRole("button", { name: "Sign in", exact: true }).click();
  }

  async openCreateAccount() {
    await this.card().getByRole("button", { name: "No account? Create one" }).click();
  }

  /** Visit /tasks while signed out and wait until the app bounces to /login. */
  async expectTasksRequireLogin() {
    await this.page.goto("/tasks");
    await this.page.waitForURL("**/login");
  }

  async signIn(email: string, password: string) {
    await this.goto();
    await this.fill(email, password);
    await this.submitSignIn();
    await expect(this.page.getByRole("heading", { name: "All Tasks" })).toBeVisible();
    await this.page.waitForURL("**/tasks");
  }

  async signUp(email: string, password: string) {
    await this.goto();
    await this.openCreateAccount();
    await this.fill(email, password);
    await this.createAccountButton().click();
    await expect(this.page.getByRole("heading", { name: "All Tasks" })).toBeVisible();
    await this.page.waitForURL("**/tasks");
  }
}
