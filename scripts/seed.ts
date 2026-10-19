import "./env";
import { sql } from "drizzle-orm";
import { catalogDefaults } from "@/config/catalog";
import { db, pool } from "@/db";
import { services } from "@/db/schema";


/**
 * Idempotent seed: inserts catalog services that don't exist yet.
 * Existing rows are NOT overwritten (prices edited in Admin are preserved).
 */
async function main() {
  for (const s of catalogDefaults) {
    await db
      .insert(services)
      .values({
        code: s.code,
        name: s.name,
        kind: s.kind,
        billing: s.billing,
        priceCents: s.priceCents,
        governmentFeeCents: s.governmentFeeCents,
        governmentFeeLabel: s.governmentFeeLabel,
        jurisdiction: s.jurisdiction,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
        shortDescription: s.shortDescription,
        features: s.features,
        config: s.config,
      })
      .onConflictDoNothing({ target: services.code });
  }
  const [{ count }] = (await db.execute<{ count: number }>(sql`select count(*)::int as count from services`)).rows;
  console.log(`Seed complete. ${count} services in catalog.`);
  console.log("Create an admin with: npm run admin:create -- --email you@example.com");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
