import { expect, test } from "@playwright/test";
import { buyRegisteredAgent, fillCompany, fillContact, horizontalOverflow, payOnReview } from "./helpers";

/**
 * Checkout behaviour beyond the happy path: back/forward and refresh keep answers,
 * incomplete steps are caught with field-level messages, an existing email signs in
 * instead, a declined card can be retried, and forming a Texas LLC becomes one order.
 */
const stamp = Date.now();
const who = (tag: string) => ({ first: "Pat", last: "Tester", email: `e2e-${tag}-${stamp}@example.com`, password: "checkout-password-123" });

test("incomplete company info shows field errors and focuses the first one", async ({ page }) => {
  await page.goto("/order/registered-agent");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Tell us whether your business already exists")).toBeVisible();
  await expect(page).not.toHaveURL(/step=contact/);
  await page.getByText("I already have a business").click();
  await page.getByRole("textbox", { name: /Formation date/ }).fill("2099-01-01");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter the legal name of your company")).toBeVisible();
  await expect(page.getByText("The formation date can't be in the future")).toBeVisible();
  await expect(page.getByLabel("Legal company name")).toBeFocused();
});

test("a visitor can't skip ahead to payment", async ({ page }) => {
  await page.goto("/order/registered-agent?step=payment");
  await expect(page.getByRole("heading", { name: "Tell us about your company" })).toBeVisible();
  await expect(page).not.toHaveURL(/step=payment/);
});

test("back, forward and refresh keep the customer's answers (never the password)", async ({ page }) => {
  const p = who("nav");
  await page.goto("/order/registered-agent?state=FL");
  await fillCompany(page, `Nav Co ${stamp} LLC`, "FL");
  await page.getByRole("button", { name: "Continue" }).click();
  await fillContact(page, p);
  await page.getByLabel("ZIP code").fill("7870");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter a valid ZIP code, like 78701")).toBeVisible();
  await page.getByLabel("ZIP code").fill("78701");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=account/);
  await page.getByLabel("Password", { exact: true }).fill(p.password);

  await page.goBack();
  await expect(page).toHaveURL(/step=contact/);
  await expect(page.getByLabel("City")).toHaveValue("Austin");
  await page.goBack();
  await expect(page.getByLabel("Legal company name")).toHaveValue(`Nav Co ${stamp} LLC`);
  await expect(page.getByLabel("State where it's registered")).toHaveValue("FL");

  await page.goForward();
  await page.reload();
  await expect(page).toHaveURL(/step=contact/);
  await expect(page.getByLabel("Email")).toHaveValue(p.email);
  const stored = await page.evaluate(() => sessionStorage.getItem("checkout:draft:v1") ?? "");
  expect(stored).toContain("Nav Co");
  expect(stored).not.toContain(p.password);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page.getByLabel("Password", { exact: true }).fill(p.password);
  await page.getByRole("button", { name: "Create account and continue" }).click();
  await expect(page.getByText(`Nav Co ${stamp} LLC`).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit company" }).click();
  await expect(page.getByLabel("Legal company name")).toHaveValue(`Nav Co ${stamp} LLC`);
  await page.getByRole("button", { name: "Continue" }).click();
  // Signed in now, so Contact → Payment skips the account step.
  await page.getByRole("button", { name: "Continue" }).click();
  await payOnReview(page);
  // The draft is cleared after payment.
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("checkout:draft:v1"))).toBeNull();
});

test("an existing email signs in instead of creating a duplicate account", async ({ page, browser }) => {
  const p = who("dupe");
  const first = await browser.newContext();
  await buyRegisteredAgent(await first.newPage(), p, `First Co ${stamp} LLC`);
  await first.close();

  await page.goto("/order/registered-agent");
  await fillCompany(page, `Second Co ${stamp} LLC`);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillContact(page, p);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill("a different password");
  await page.getByRole("button", { name: "Create account and continue" }).click();
  await expect(page.getByText("There's already an account for this email")).toBeVisible();
  await page.getByRole("button", { name: "Sign in and continue" }).click();
  await expect(page.getByText("That password doesn't match this email")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(p.password);
  await page.getByRole("button", { name: "Sign in and continue" }).click();
  await expect(page.getByText(`Signed in as ${p.email}`)).toBeVisible();
  await payOnReview(page);
});

test("a declined card can be retried without losing the order", async ({ page }) => {
  const p = who("declined");
  await page.goto("/order/registered-agent");
  await fillCompany(page, `Declined Co ${stamp} LLC`);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillContact(page, p);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill(p.password);
  await page.getByRole("button", { name: "Create account and continue" }).click();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: /Pay \$99 securely/ }).click();
  await expect(page).toHaveURL(/simulated-checkout/);
  await page.getByRole("link", { name: "Simulate a declined card" }).click();
  await expect(page.getByRole("alert").getByText("Your card was declined")).toBeVisible();
  await page.getByRole("button", { name: "Pay (simulated)" }).click();
  await expect(page.getByRole("heading", { name: /Payment received/ })).toBeVisible();
});

test("forming a Texas LLC from the registered agent checkout becomes one formation order", async ({ page }) => {
  const p = who("form");
  await page.goto("/order/registered-agent");
  await page.getByText("I'm forming a new business").click();
  await page.getByLabel("Company name you plan to use").fill(`Bluebonnet ${stamp}`);
  await page.getByRole("button", { name: /Form my LLC with/ }).click();
  await expect(page).toHaveURL(/\/order\/llc-formation/);
  await expect(page.getByLabel("LLC name you'd like")).toHaveValue(`Bluebonnet ${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillContact(page, p);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Password", { exact: true }).fill(p.password);
  await page.getByRole("button", { name: "Create account and continue" }).click();
  // Service fee, government fee and registered agent are itemized separately.
  const summary = page.locator("aside");
  await expect(summary.getByText("Texas LLC Formation: service fee")).toBeVisible();
  await expect(summary.getByText("Government fee, paid to the state at cost")).toBeVisible();
  await expect(summary.getByText("Registered Agent Service (first year)")).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay \$548 securely/ })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await payOnReview(page);
  await expect(page.getByText(/Texas LLC Formation/).first()).toBeVisible();
});
