import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";

/**
 * The launch milestone, end to end:
 * visitor → registered agent checkout (simulated Stripe) → onboarding →
 * order in admin → manual fulfillment → customer sees status, documents and RA details.
 */
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const customer = { first: "Casey", last: "Customer", email: `e2e-${stamp}@example.com`, password: "e2e-customer-password" };
const businessName = `E2E Widgets ${stamp} LLC`;
let orderUrl = "";
let orderNumber = "";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(account|admin)/);
}

test("visitor buys registered agent service and completes onboarding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Business compliance services");
  await page.getByRole("link", { name: "Get registered agent service" }).first().click();
  await expect(page).toHaveURL(/\/order\/registered-agent/);
  await expect(page.getByText("Due today")).toBeVisible();

  // Account step (inline in checkout).
  await page.locator("#co-signup-first").fill(customer.first);
  await page.locator("#co-signup-last").fill(customer.last);
  await page.locator("#co-signup-email").fill(customer.email);
  await page.locator("#co-signup-password").fill(customer.password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Details step.
  await page.getByLabel("Legal business name").fill(businessName);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByText("Please accept the terms to continue")).toBeVisible();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  // Simulated Stripe Checkout (dev/CI only).
  await expect(page).toHaveURL(/simulated-checkout/);
  await page.getByRole("button", { name: "Pay (simulated)" }).click();
  await expect(page.getByRole("heading", { name: /Payment received/ })).toBeVisible();
  orderNumber = (await page.getByText(/Order #\d+/).first().innerText()).match(/#(\d+)/)![1];

  // Onboarding.
  await page.getByRole("link", { name: "Complete business information" }).click();
  await expect(page.getByRole("heading", { name: "Tell us about your business" })).toBeVisible();
  await expect(page.getByLabel("Legal business name")).toHaveValue(businessName);
  await page.getByLabel("Street address").first().fill("100 Congress Ave");
  await page.getByLabel("City").first().fill("Austin");
  await page.getByLabel("ZIP").first().fill("78701");
  await page.locator('[name="contact.phone"]').fill("512-555-0100");
  await page.getByLabel("My business already exists and currently has a different registered agent").check();
  await page.getByLabel("Current registered agent's name").fill("Previous Agent Co");
  await page.getByLabel(/I am authorized to appoint/).check();
  await page.getByRole("button", { name: "Submit business information" }).click();

  await expect(page).toHaveURL(/submitted=1/);
  await expect(page.getByRole("status").getByText("Information received")).toBeVisible();
  await expect(page.getByText("In progress")).toBeVisible();
  orderUrl = new URL(page.url()).pathname;
});

test("admin sees the order and fulfills it manually", async ({ page }) => {
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: new RegExp(`#${orderNumber}`) }).first().click();
  await expect(page.getByRole("heading", { name: `Order #${orderNumber}` })).toBeVisible();

  // Provider entry sheet has the customer's data, ready to copy into the partner dashboard.
  const sheet = page.locator("section", { hasText: "Entity" }).first();
  await expect(sheet.getByText(businessName)).toBeVisible();
  await expect(page.getByText("Previous Agent Co").first()).toBeVisible();

  // Submitted to provider (requires the partner's reference).
  await page.getByLabel("Move order to").selectOption("submitted_to_provider");
  await page.getByLabel("Provider order / reference #").fill("PARTNER-E2E-001");
  await page.locator('textarea[name="note"]').fill("Placed in partner dashboard during e2e run");
  await page.getByRole("button", { name: "Update order" }).click();
  await expect(page.getByText("Order updated.")).toBeVisible();
  await expect(page.getByText("ref PARTNER-E2E-001")).toBeVisible();

  // Processing.
  await page.getByLabel("Move order to").selectOption("processing");
  await page.getByRole("button", { name: "Update order" }).click();
  await expect(page.getByText("Order updated.")).toBeVisible();

  // Upload a customer-visible document.
  await page.getByLabel("Document type").selectOption("state_correspondence");
  await page.getByLabel("Title").fill("Registered agent confirmation");
  await page.locator("#admin-file").setInputFiles(path.join(__dirname, "fixtures", "sample.pdf"));
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();

  // Complete, recording the RA details assigned by the provider.
  await page.getByLabel("Move order to").selectOption("completed");
  await page.getByLabel("Registered agent name").fill("Partner Registered Agent, Inc.");
  await page.getByLabel("Registered office address").fill("700 Lavaca St Ste 1401, Austin, TX 78701");
  await page.getByRole("button", { name: "Update order" }).click();
  await expect(page.getByText("Order updated.")).toBeVisible();
  await expect(page.getByText("Completed").first()).toBeVisible();

  // Audit trail and email outbox reflect the work.
  await expect(page.getByText("order.status_changed").first()).toBeVisible();
  await expect(page.getByText(/has been submitted/).first()).toBeVisible();
});

test("customer sees completion, documents, RA details and billing", async ({ page, request }) => {
  await signIn(page, customer.email, customer.password);
  await page.goto(orderUrl);
  await expect(page.getByText("Completed").first()).toBeVisible();
  await expect(page.getByText("Registered agent confirmation")).toBeVisible();

  // Document download goes through the authorized route and returns the PDF.
  const href = await page.getByRole("link", { name: /Download Registered agent confirmation/ }).getAttribute("href");
  const download = await page.request.get(href!);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toBe("application/pdf");
  expect(download.headers()["cache-control"]).toContain("no-store");
  // Without a session the same URL is refused.
  expect((await request.get(href!)).status()).toBe(401);

  // Entity page shows the registered agent details to use with the state.
  await page.getByRole("link", { name: `View ${businessName}` }).click();
  await expect(page.getByText("Partner Registered Agent, Inc.")).toBeVisible();
  await expect(page.getByText("700 Lavaca St Ste 1401, Austin, TX 78701")).toBeVisible();

  // Billing: renewal date, receipt line, and auto-renewal can be turned off with a clear warning.
  await page.getByRole("link", { name: "Billing" }).click();
  await expect(page.getByText(/Renews/).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: /Order #/ })).toBeVisible();
  await page.getByRole("button", { name: "Turn off auto-renewal" }).first().click();
  await expect(page.getByText(/you'll need to appoint a new one with the state/)).toBeVisible();
  await page.getByLabel("I understand and want to turn off auto-renewal.").check();
  await page.getByRole("button", { name: "Turn off auto-renewal" }).click();
  await expect(page.getByText(/Auto-renewal is off/)).toBeVisible();
});
