/**
 * Side-effect import: load .env for CLI scripts before any module reads
 * process.env (Next.js does this itself for the app). Import this FIRST.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file; rely on the real environment
}
export {};
