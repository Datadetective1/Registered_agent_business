import path from "node:path";
import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";
import { fillContact, horizontalOverflow, signIn } from "./helpers";

/**
 * The launch milestone, end to end:
 * mobile visitor → registered agent checkout (Company → Contact → Account → Payment,
 * simulated Stripe) → confirmation → onboarding → order in their account and in
 * admin → manual fulfillment (including a change-of-agent filing) → customer sees
 * status, documents and registered agent details.
 */
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const customer = { first: "Casey", last: "Customer", email: `e2e-${stamp}@example.com`, password: "e2e-customer-password" };
const businessName = `E2E Widgets ${stamp} LLC`;
let orderUrl = "";
let orderNumber = "";

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("visitor buys registered agent service and completes onboarding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("registered agent service");
    await page.getByRole("link", { name: "Get registered agent service" }).first().click();
    await expect(page).toHaveURL(/\/order\/registered-agent/);
    await expect(page.getByText("Step 1 of 4: Company")).toBeVisible();

    // Step 1: company. The formation date is optional ("I don't know").
    await page.getByText("I already have a business").click();
    await page.getByLabel("Legal company name").fill(businessName);
    await page.getByLabel("I don't know my formation date").check();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: contact.
    await expect(page.getByText("Step 2 of 4: Contact")).toBeVisible();
    await fillContact(page, customer);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: account, created inside checkout.
    await expect(page.getByText("Step 3 of 4: Account")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(customer.email);
    await page.getByLabel("Password", { exact: true }).fill(customer.password);
    await page.getByRole("button", { name: "Create account and continue" }).click();

    // Step 4: itemized review, then payment.
    await expect(page.getByText("Step 4 of 4: Payment")).toBeVisible();
    await expect(page.getByText(businessName).first()).toBeVisible();
    const review = page.getByRole("region", { name: "Review and pay" });
    await expect(review.getByText("Registered Agent Service (first year)")).toBeVisible();
    await expect(review.getByText("Due today")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: /Pay \$99 securely/ }).click();
    await expect(page.getByText("Please agree to the terms to continue")).toBeVisible();
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: /Pay \$99 securely/ }).click();

    // Simulated Stripe Checkout (dev/CI only).
    await expect(page).toHaveURL(/simulated-checkout/);
    await page.getByRole("button", { name: "Pay (simulated)" }).click();
    await expect(page.getByRole("heading", { name: /Payment received/ })).toBeVisible();
    orderNumber = (await page.getByText(/Order #\d+/).first().innerText()).match(/#(\d+)/)![1];

    // The order is in their account.
    await page.getByRole("link", { name: "Go to my account" }).click();
    await expect(page.getByText(`Tell us about your business (order #${orderNumber})`)).toBeVisible();

    // Onboarding is prefilled from checkout.
    await page.getByRole("link", { name: "Continue to business details" }).click();
    await expect(page.getByRole("heading", { name: "Tell us about your business" })).toBeVisible();
    await expect(page.locator('[name="entity.legalName"]')).toHaveValue(businessName);
    await expect(page.locator('[name="principalAddress.line1"]')).toHaveValue("100 Congress Ave");
    await expect(page.locator('[name="contact.email"]')).toHaveValue(customer.email);
    await page.getByLabel("My business already exists and currently has a different registered agent").check();
    await page.getByLabel("Current registered agent's name").fill("Previous Agent Co");
    await page.getByLabel(/I am authorized to appoint/).check();
    await page.getByRole("button", { name: "Submit business information" }).click();

    await expect(page).toHaveURL(/submitted=1/);
    await expect(page.getByRole("status").getByText("Information received")).toBeVisible();
    await expect(page.getByText("Information submitted").first()).toBeVisible();
    orderUrl = new URL(page.url()).pathname;
  });
});

test("admin sees the order and fulfills it manually, including the change of agent", async ({ page }) => {
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Ready for provider").first()).toBeVisible();
  await page.getByRole("link", { name: new RegExp(`#${orderNumber}`) }).first().click();
  await expect(page.getByRole("heading", { name: `Order #${orderNumber}` })).toBeVisible();
  await expect(page.getByText("Registered agent + change of agent filing")).toBeVisible();

  // Provider entry sheet has the customer's data, ready to copy into the partner dashboard.
  await expect(page.getByText(businessName).first()).toBeVisible();
  await expect(page.getByText("Previous Agent Co").first()).toBeVisible();

  // Submitted to provider (requires the partner's reference).
  await page.getByRole("button", { name: "Mark submitted to provider" }).click();
  await page.getByLabel("Provider order / reference #").fill("PARTNER-E2E-001");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Order updated. It's now Submitted to Provider.")).toBeVisible();
  await expect(page.getByText("ref PARTNER-E2E-001").first()).toBeVisible();

  await page.getByRole("button", { name: "Mark processing" }).click();
  await expect(page.getByText("Order updated. It's now Processing.")).toBeVisible();

  // Upload a customer-visible document.
  await page.getByLabel("Document type").selectOption("state_correspondence");
  await page.getByLabel("Title").fill("Registered agent confirmation");
  await page.locator("#admin-file").setInputFiles(path.join(__dirname, "fixtures", "sample.pdf"));
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();

  // The order can't complete while the change-of-agent filing is open.
  const agent = async () => {
    await page.getByRole("button", { name: "Mark completed" }).click();
    await page.getByLabel(/Registered agent name/).fill("Partner Registered Agent, Inc.");
    await page.getByLabel("Registered office address").fill("700 Lavaca St Ste 1401, Austin, TX 78701");
    await page.getByRole("button", { name: "Confirm" }).click();
  };
  await agent();
  await expect(page.getByText(/change-of-agent filing is still open/)).toBeVisible();

  // Track the filing on its own: reference → submitted → completed.
  const filing = page.locator("form").filter({ has: page.getByLabel("Move to") });
  await filing.getByLabel("Provider reference / filing #").fill("TX-401-E2E");
  await filing.getByLabel("Move to").selectOption("submitted");
  await filing.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await filing.getByLabel("Move to").selectOption("completed");
  await filing.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();

  await agent();
  await expect(page.getByText("Order updated. It's now Completed.")).toBeVisible();

  // Status history and email outbox reflect the work.
  await expect(page.getByText("Submitted to Provider → Processing")).toBeVisible();
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
