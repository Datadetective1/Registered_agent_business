/**
 * Upload validation. The file type is determined from its content ("magic bytes"),
 * never from the browser-supplied name or MIME type.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type DetectedType = { mime: string; ext: "pdf" | "png" | "jpg" | "webp" | "heic" };

export function detectFileType(buf: Buffer): DetectedType | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.length >= 12 && buf.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|mif1|msf1)$/.test(buf.subarray(8, 12).toString("latin1"))) {
    return { mime: "image/heic", ext: "heic" };
  }
  return null;
}

export const ACCEPT_ATTR = ".pdf,.png,.jpg,.jpeg,.webp,.heic,application/pdf,image/png,image/jpeg,image/webp,image/heic";
export const ACCEPT_LABEL = "PDF, PNG, JPG, WEBP or HEIC, up to 15 MB";

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  return cleaned || "document";
}
