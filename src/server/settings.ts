import "server-only";
import { asc, eq } from "drizzle-orm";
import { siteDefaults, type SiteSettings } from "@/config/site";
import { db, type Executor } from "@/db";
import { services, settings, type Service } from "@/db/schema";

/**
 * Settings & catalog access with a short in-process cache.
 *
 * Every public page reads branding and prices, so these are cached for a minute
 * and invalidated immediately when an admin saves changes (same process). With
 * multiple app instances, other instances pick up changes within TTL_MS.
 */
const TTL_MS = 60_000;
const SITE_KEY = "site";

type Cache = {
  site?: { value: SiteSettings; expires: number };
  services?: { value: Service[]; expires: number };
};
const g = globalThis as unknown as { __settingsCache?: Cache };
const cache: Cache = (g.__settingsCache ??= {});

export function invalidateSettingsCache() {
  cache.site = undefined;
  cache.services = undefined;
}

type PlainObject = Record<string, unknown>;
const isPlainObject = (v: unknown): v is PlainObject => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Merge an override onto defaults. Only keys that exist in the defaults are
 * accepted, and only when the value has the same shape (prevents a malformed
 * DB row from breaking the site). `legal.reviewed` is a free-form record.
 */
export function mergeSettings<T>(defaults: T, override: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(override)) return defaults;
  const out: PlainObject = { ...defaults };
  for (const [key, defVal] of Object.entries(defaults)) {
    if (!(key in override)) continue;
    const val = override[key];
    if (isPlainObject(defVal)) {
      out[key] = isPlainObject(val) ? { ...mergeSettings(defVal, val), ...pickBooleans(defVal, val) } : defVal;
    } else if (Array.isArray(defVal)) {
      out[key] = Array.isArray(val) ? val : defVal;
    } else if (typeof val === typeof defVal) {
      out[key] = val;
    }
  }
  return out as T;
}

// Allow new boolean keys inside boolean-only records (e.g. legal.reviewed).
function pickBooleans(defVal: PlainObject, val: PlainObject): PlainObject {
  const values = Object.values(defVal);
  if (values.length === 0 || !values.every((v) => typeof v === "boolean")) return {};
  return Object.fromEntries(Object.entries(val).filter(([, v]) => typeof v === "boolean"));
}

export async function getSettings(): Promise<SiteSettings> {
  const now = Date.now();
  if (cache.site && cache.site.expires > now) return cache.site.value;
  let override: unknown = {};
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, SITE_KEY)).limit(1);
    override = row?.value ?? {};
  } catch (err) {
    // If the DB is unreachable, fall back to defaults so public pages still render.
    console.error("[settings] failed to load overrides; using defaults", err);
    return siteDefaults;
  }
  const value = mergeSettings(siteDefaults, override);
  cache.site = { value, expires: now + TTL_MS };
  return value;
}

/** Raw override object as stored (for the admin editor). */
export async function getSiteOverride(): Promise<PlainObject> {
  const [row] = await db.select().from(settings).where(eq(settings.key, SITE_KEY)).limit(1);
  return (row?.value as PlainObject) ?? {};
}

export async function saveSiteOverride(value: PlainObject, userId: string | null, tx: Executor = db) {
  await tx
    .insert(settings)
    .values({ key: SITE_KEY, value, updatedByUserId: userId })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedByUserId: userId, updatedAt: new Date() } });
  invalidateSettingsCache();
}

/* --------------------------------- catalog -------------------------------- */

export async function getAllServices(): Promise<Service[]> {
  const now = Date.now();
  if (cache.services && cache.services.expires > now) return cache.services.value;
  const rows = await db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
  cache.services = { value: rows, expires: now + TTL_MS };
  return rows;
}

export async function getServiceByCode(code: string): Promise<Service | undefined> {
  return (await getAllServices()).find((s) => s.code === code);
}

export async function getActiveServiceByCode(code: string): Promise<Service | undefined> {
  const s = await getServiceByCode(code);
  return s?.isActive ? s : undefined;
}

export function serviceAvailableStates(service: Service | undefined): string[] {
  const states = (service?.config as { availableStates?: unknown } | undefined)?.availableStates;
  return Array.isArray(states) ? states.filter((s): s is string => typeof s === "string") : [];
}

/* ------------------------- generic key/value settings ------------------------ */

export async function getSettingValue<T extends PlainObject>(key: string): Promise<T | undefined> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value as T | undefined;
}

export async function setSettingValue(key: string, value: PlainObject, tx: Executor = db) {
  await tx
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}
