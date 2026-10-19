import "server-only";

/**
 * Runtime configuration derived from environment variables. Read lazily so that
 * `next build` works without any secrets present.
 */
export type PaymentsMode = "stripe" | "simulated" | "disabled";

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function paymentsMode(): PaymentsMode {
  const explicit = process.env.PAYMENTS_MODE?.trim();
  if (explicit === "simulated") {
    // The simulated gateway must never run in a production build.
    return isProduction() ? "disabled" : "simulated";
  }
  if (explicit === "disabled") return "disabled";
  if (explicit === "stripe" || process.env.STRIPE_SECRET_KEY) {
    return stripeKeyAllowed() ? "stripe" : "disabled";
  }
  return isProduction() ? "disabled" : "simulated";
}

/** Live Stripe keys are refused unless STRIPE_ALLOW_LIVE=true is set explicitly. */
export function stripeKeyAllowed(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) return false;
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return true;
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return process.env.STRIPE_ALLOW_LIVE === "true";
  return false;
}

export function stripeIsTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").includes("_test_");
}

export function emailTransportName(): "log" | "resend" {
  return process.env.EMAIL_TRANSPORT === "resend" ? "resend" : "log";
}

export function storageDir(): string {
  return process.env.STORAGE_DIR ?? "./storage";
}

export function cronSecret(): string | undefined {
  return process.env.CRON_SECRET || undefined;
}
