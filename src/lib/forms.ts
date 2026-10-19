import { z } from "zod";

export type FieldErrors = Record<string, string>;

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  /** Echo of submitted (non-secret) values so forms can be re-populated after an error. */
  values?: Record<string, string>;
};

const NUMERIC = /^\d+$/;

/**
 * Convert FormData with dotted keys ("entity.legalName", "people.0.name") into a nested
 * object. Files are skipped (handled separately by upload code).
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    if (key.startsWith("$ACTION")) continue;
    const parts = key.split(".");
    let node: Record<string, unknown> | unknown[] = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const last = i === parts.length - 1;
      const k: string | number = NUMERIC.test(part) ? Number(part) : part;
      if (k === "__proto__" || k === "constructor" || k === "prototype") break;
      const container = node as Record<string | number, unknown>;
      if (last) {
        container[k] = raw;
      } else {
        if (container[k] === undefined) container[k] = NUMERIC.test(parts[i + 1]) ? [] : {};
        node = container[k] as Record<string, unknown>;
      }
    }
  }
  return compactArrays(root) as Record<string, unknown>;
}

function compactArrays(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map(compactArrays);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compactArrays(v)]));
  }
  return value;
}

export function zodErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_form";
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

/** Flat string echo of submitted values, excluding secrets. */
export function echoValues(formData: FormData, exclude: string[] = ["password", "confirmPassword", "currentPassword", "newPassword"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !exclude.includes(k) && !k.startsWith("$ACTION")) out[k] = v;
  }
  return out;
}

export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.output<T> } | { ok: false; errors: FieldErrors; values: Record<string, string> } {
  const result = schema.safeParse(formDataToObject(formData));
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: zodErrors(result.error), values: echoValues(formData) };
}

/* ---------------------------- reusable field types --------------------------- */

export const text = (max = 200, label = "This field") =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, "Too long")
    .optional()
    .transform((v) => (v ? v : undefined));

export const email = () =>
  z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email({ error: "Enter a valid email address" }));

const PHONE = /^\+?[\d\s().-]{10,20}$/;

export const phone = () =>
  z
    .string({ error: "Phone is required" })
    .trim()
    .min(1, "Phone is required")
    .max(30)
    .refine((v) => PHONE.test(v), "Enter a valid phone number");

export const optionalPhone = () =>
  z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || PHONE.test(v), "Enter a valid phone number")
    .optional()
    .transform((v) => (v ? v : undefined));

/** HTML checkbox → boolean. */
export const checkbox = () => z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** A checkbox that must be ticked. */
export const mustAccept = (message: string) =>
  z.preprocess((v) => v === "on" || v === "true" || v === true, z.literal(true, { error: message }));

/** Flatten a nested object into dotted form keys (the inverse of formDataToObject). */
export function flattenToFormValues(obj: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj === "boolean") {
    if (obj) out[prefix] = "on";
    return out;
  }
  if (typeof obj !== "object") {
    out[prefix] = String(obj);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    flattenToFormValues(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}
