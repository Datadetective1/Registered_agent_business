import { expect, test } from "@playwright/test";

/**
 * Mobile layout check (iPhone-sized viewport): key pages render without horizontal
 * scrolling, and the menu works without JavaScript-heavy widgets. Screenshots are
 * saved to tests/e2e/screenshots for visual review.
 */
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const PAGES = [
  "/",
  "/registered-agent",
  "/start-an-llc",
  "/business-address",
  "/pricing",
  "/how-it-works",
  "/faq",
  "/about",
  "/contact",
  "/registered-agent/texas",
  "/legal/terms",
  "/sign-in",
  "/create-account",
  "/order/registered-agent",
  "/order/llc-formation",
];

for (const path of PAGES) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `tests/e2e/screenshots/mobile${path === "/" ? "-home" : path.replace(/\//g, "-")}.png`, fullPage: true });
  });
}

test("mobile menu opens and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Open menu").click();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Pricing" }).click();
  await expect(page).toHaveURL(/\/pricing/);
});

test("customer account and onboarding work on mobile", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/order/registered-agent");
  await page.locator("#co-signup-first").fill("Mo");
  await page.locator("#co-signup-last").fill("Bile");
  await page.locator("#co-signup-email").fill(`e2e-mobile-${stamp}@example.com`);
  await page.locator("#co-signup-password").fill("mobile-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Legal business name").fill(`Mobile Co ${stamp} LLC`);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("button", { name: "Pay (simulated)" }).click();
  await page.getByRole("link", { name: "Complete business information" }).click();
  await expect(page.getByRole("heading", { name: "Tell us about your business" })).toBeVisible();
  for (const p of ["onboarding", "account"]) {
    if (p === "account") await page.goto("/account");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `tests/e2e/screenshots/mobile-${p}.png`, fullPage: true });
  }
});
