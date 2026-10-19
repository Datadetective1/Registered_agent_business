import { expect, type Page } from "@playwright/test";

export type Buyer = { first: string; last: string; email: string; password: string };

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(account|admin)/);
}

/** Step 1 of the registered agent checkout for an existing business. */
export async function fillCompany(page: Page, business: string, state = "TX") {
  await page.getByText("I already have a business").click();
  await page.getByLabel("Legal company name").fill(business);
  await page.getByLabel("State where it's registered").selectOption(state);
}

/** Step 2: a US contact. */
export async function fillContact(page: Page, who: Pick<Buyer, "first" | "last" | "email">) {
  await page.getByLabel("First name").fill(who.first);
  await page.getByLabel("Last name").fill(who.last);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Phone").fill("512-555-0100");
  await page.getByLabel("Street address").fill("100 Congress Ave");
  await page.getByLabel("City").fill("Austin");
  await page.getByLabel("State", { exact: true }).selectOption("TX");
  await page.getByLabel("ZIP code").fill("78701");
}

/** Accept terms on the review step and pay through the simulated gateway. */
export async function payOnReview(page: Page) {
  await expect(page.getByRole("heading", { name: "Review and pay" })).toBeVisible();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: /Pay \$[\d,.]+ securely/ }).click();
  await expect(page).toHaveURL(/simulated-checkout/);
  await page.getByRole("button", { name: "Pay (simulated)" }).click();
  await expect(page.getByRole("heading", { name: /Payment received/ })).toBeVisible();
}

/** Full registered agent purchase as a new visitor. Returns the order id. */
export async function buyRegisteredAgent(page: Page, who: Buyer, business: string): Promise<string> {
  await page.goto("/order/registered-agent");
  await fillCompany(page, business);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillContact(page, who);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Create account and continue" }).click();
  await payOnReview(page);
  return new URL(page.url()).pathname.split("/")[2];
}

export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
