import { sql } from "drizzle-orm";
import { db } from "@/db";
import { invalidateSettingsCache } from "@/server/settings";

const TABLES = [
  "analytics_events",
  "rate_limits",
  "settings",
  "audit_events",
  "admin_notes",
  "support_requests",
  "notifications",
  "documents",
  "information_requests",
  "provider_orders",
  "webhook_events",
  "payments",
  "entity_services",
  "subscriptions",
  "order_items",
  "orders",
  "services",
  "entities",
  "customers",
  "addresses",
  "user_tokens",
  "sessions",
  "users",
];

/** Wipe all data between integration test files. */
export async function resetDb() {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`));
  invalidateSettingsCache();
}
