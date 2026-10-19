import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://app:app@localhost:5432/bizagent_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Next.js enforces this import at build time; in tests it's a no-op.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      APP_URL: "http://localhost:3000",
      PAYMENTS_MODE: "simulated",
      EMAIL_TRANSPORT: "log",
      STORAGE_DIR: path.resolve(import.meta.dirname, ".test-storage"),
      CRON_SECRET: "test-cron-secret",
    },
  },
});
