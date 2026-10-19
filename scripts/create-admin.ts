import "./env";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { pool } from "@/db";
import { upsertAdmin } from "@/server/auth/accounts";
import { PASSWORD_MIN } from "@/server/auth/password";


/**
 * Create (or reset) an admin account. There is intentionally no public admin signup.
 *   npm run admin:create -- --email ops@yourdomain.com [--password '...'] [--name 'Jane']
 * Without --password a strong random password is generated and printed once.
 */
async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, password: { type: "string" }, name: { type: "string" } },
  });
  if (!values.email) throw new Error("--email is required");
  const password = values.password ?? randomBytes(18).toString("base64url");
  if (password.length < PASSWORD_MIN) throw new Error(`Password must be at least ${PASSWORD_MIN} characters`);
  await upsertAdmin(values.email, password, values.name);
  console.log(`Admin ready: ${values.email}`);
  if (!values.password) console.log(`Generated password (shown once): ${password}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
