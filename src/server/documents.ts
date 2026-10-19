import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { customers, documents, entities, type DocumentRow, type DocumentType } from "@/db/schema";
import { DOCUMENT_TYPE_LABEL, URGENT_DOCUMENT_TYPES } from "@/lib/labels";
import { audit, type Actor } from "./audit";
import { sendEmail } from "./notifications/send";
import { getStorage } from "./storage";
import { detectFileType, MAX_UPLOAD_BYTES, sanitizeFilename } from "./storage/validate";

export class UploadError extends Error {}

export type NewDocument = {
  customerId: string;
  entityId?: string | null;
  orderId?: string | null;
  informationRequestId?: string | null;
  type: DocumentType;
  title?: string;
  file: File;
  source: "customer" | "admin" | "provider" | "system";
  visibility: "customer" | "internal";
  uploadedByUserId: string | null;
  metadata?: Record<string, unknown>;
};

/** Validate, store privately, and record a document. */
export async function createDocument(input: NewDocument, actor: Actor): Promise<DocumentRow> {
  if (!(input.file instanceof File) || input.file.size === 0) throw new UploadError("Choose a file to upload.");
  if (input.file.size > MAX_UPLOAD_BYTES) throw new UploadError("That file is larger than 15 MB.");
  const data = Buffer.from(await input.file.arrayBuffer());
  const detected = detectFileType(data);
  if (!detected) throw new UploadError("Please upload a PDF or an image (PNG, JPG, WEBP, HEIC).");

  const key = `${input.customerId}/${randomUUID()}.${detected.ext}`;
  await getStorage().put(key, data);
  const filename = sanitizeFilename(input.file.name);
  try {
    const [row] = await db
      .insert(documents)
      .values({
        customerId: input.customerId,
        entityId: input.entityId ?? null,
        orderId: input.orderId ?? null,
        informationRequestId: input.informationRequestId ?? null,
        type: input.type,
        title: (input.title?.trim() || filename).slice(0, 200),
        originalFilename: filename,
        storageKey: key,
        mimeType: detected.mime,
        sizeBytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
        source: input.source,
        visibility: input.visibility,
        metadata: input.metadata ?? {},
        uploadedByUserId: input.uploadedByUserId,
      })
      .returning();
    await audit({
      actor,
      action: "document.uploaded",
      targetType: "document",
      targetId: row.id,
      customerId: row.customerId,
      orderId: row.orderId,
      metadata: { type: row.type, visibility: row.visibility, size: row.sizeBytes },
    });
    return row;
  } catch (err) {
    await getStorage().delete(key);
    throw err;
  }
}

/**
 * Authorization for a document. Admins can access any document. Customers only
 * their own, customer-visible, non-archived documents. Everything else is "not found".
 */
export function canAccessDocument(doc: DocumentRow, viewer: { role: "customer" | "admin"; customerId: string | null }): boolean {
  if (viewer.role === "admin") return true;
  return doc.customerId === viewer.customerId && doc.visibility === "customer" && doc.status !== "archived";
}

export async function readDocument(doc: DocumentRow): Promise<Buffer> {
  return getStorage().get(doc.storageKey);
}

export async function listCustomerDocuments(customerId: string, filter: { entityId?: string; orderId?: string } = {}) {
  const conds = [eq(documents.customerId, customerId), eq(documents.visibility, "customer"), ne(documents.status, "archived")];
  if (filter.entityId) conds.push(eq(documents.entityId, filter.entityId));
  if (filter.orderId) conds.push(eq(documents.orderId, filter.orderId));
  return db.select().from(documents).where(and(...conds)).orderBy(desc(documents.createdAt));
}

/** Email the customer that a document is available (used after admin uploads). */
export async function notifyCustomerOfDocument(doc: DocumentRow) {
  if (doc.visibility !== "customer") return;
  const [customer] = await db.select().from(customers).where(eq(customers.id, doc.customerId)).limit(1);
  if (!customer) return;
  const [entity] = doc.entityId ? await db.select().from(entities).where(eq(entities.id, doc.entityId)).limit(1) : [];
  await sendEmail({
    template: "new_document",
    to: customer.email,
    customerId: customer.id,
    orderId: doc.orderId,
    entityId: doc.entityId,
    data: {
      firstName: customer.firstName,
      entityName: entity?.legalName ?? "your business",
      documentTitle: doc.title,
      documentTypeLabel: DOCUMENT_TYPE_LABEL[doc.type],
      urgent: URGENT_DOCUMENT_TYPES.includes(doc.type),
      entityId: doc.entityId,
    },
  });
}
