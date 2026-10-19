import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the dev server (simulated payments are refused in
 * production builds by design). The global setup migrates and seeds the database
 * from .env and creates a dedicated e2e admin.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH === "/opt/pw-browsers" ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: chromium ? { executablePath: chromium } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { PAYMENTS_MODE: "simulated", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
