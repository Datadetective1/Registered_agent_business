import { expect, test, type Page } from "@playwright/test";

/**
 * Authorization boundaries through the real HTTP stack: customers can't see each
 * other's data, can't reach admin, and anonymous users are sent to sign in.
 */
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const alice = { email: `e2e-alice-${stamp}@example.com`, password: "alice-password-123" };
const bob = { email: `e2e-bob-${stamp}@example.com`, password: "bob-password-1234" };
let aliceOrder = "";

async function signUpAndBuy(page: Page, who: typeof alice, business: string) {
  await page.goto("/create-account?returnTo=/order/registered-agent");
  await page.getByLabel("First name").fill("Test");
  await page.getByLabel("Last name").fill("User");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Legal business name").fill(business);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("button", { name: "Pay (simulated)" }).click();
  await expect(page.getByRole("heading", { name: /Payment received/ })).toBeVisible();
  return new URL(page.url()).pathname.split("/")[2];
}

test("anonymous visitors are redirected away from private areas", async ({ page, request }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in/);
  const res = await request.get("/api/documents/00000000-0000-0000-0000-000000000000/download");
  expect(res.status()).toBe(401);
});

test("a customer cannot see another customer's order or reach admin", async ({ browser }) => {
  const aCtx = await browser.newContext();
  const a = await aCtx.newPage();
  aliceOrder = await signUpAndBuy(a, alice, `Alice Co ${stamp} LLC`);
  await aCtx.close();

  const bCtx = await browser.newContext();
  const b = await bCtx.newPage();
  await signUpAndBuy(b, bob, `Bob Co ${stamp} LLC`);

  for (const url of [`/account/orders/${aliceOrder}`, `/account/orders/${aliceOrder}/onboarding`, `/order/${aliceOrder}/success`]) {
    const res = await b.goto(url);
    expect(res?.status(), url).toBe(404);
  }
  await b.goto("/admin");
  await expect(b).toHaveURL(/\/account$/);
  await expect(b.getByText(`Alice Co ${stamp} LLC`)).toHaveCount(0);
  await bCtx.close();
});

test("server actions and APIs reject cross-site requests", async ({ request }) => {
  const res = await request.post("/api/analytics/event", {
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    data: { name: "pricing_viewed" },
  });
  expect(res.status()).toBe(403);
});
