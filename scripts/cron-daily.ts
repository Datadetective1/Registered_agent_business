import "./env";
import { pool } from "@/db";
import { runDailyJobs } from "@/server/jobs";

/** Run the daily jobs directly (alternative to calling POST /api/cron/daily). */
runDailyJobs()
  .then(async (r) => {
    console.log(`Daily jobs complete. Renewal reminders sent: ${r.reminders}`);
    await pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
