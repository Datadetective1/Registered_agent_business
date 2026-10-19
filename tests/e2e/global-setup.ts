import { execSync } from "node:child_process";
import { Pool } from "pg";

export const E2E_ADMIN = { email: "e2e-admin@example.com", password: "e2e-admin-password-123" };

export default async function globalSetup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // CI provides env vars directly
  }
  const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env: process.env });
  run("npm run db:migrate --silent");
  run("npm run db:seed --silent");
  run(`npm run admin:create --silent -- --email ${E2E_ADMIN.email} --password ${E2E_ADMIN.password} --name "E2E Admin"`);
  // Fresh rate-limit windows so repeated local runs don't trip signup/login limits.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await pool.query("DELETE FROM rate_limits");
  await pool.end();
}
