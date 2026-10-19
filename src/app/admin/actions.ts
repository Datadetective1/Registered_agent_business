"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { STATE_CODES } from "@/config/states";
import { documentType, entityStatus, orderStatus, providerOrderStatus } from "@/db/schema";
import { formDataToObject, zodErrors, type FormState } from "@/lib/forms";
import { parseDollarsToCents } from "@/lib/money";
import {
  activateEntityService,
  addAdminNote,
  AdminActionError,
  changeOrderStatus,
  closeInformationRequest,
  refundOrder,
  setDocumentState,
  updateProviderOrder,
  setSupportStatus,
  updateEntityRecord,
  uploadAdminDocument,
} from "@/server/admin/operations";
import { saveService, saveSiteSettings, serviceSchema, siteSettingsSchema } from "@/server/admin/settings-ops";
import { adminOrNull } from "@/server/auth/guards";
import { UploadError } from "@/server/documents";

const DENIED: FormState = { message: "Not authorized." };

async function admin() {
  const s = await adminOrNull();
  return s ? { type: "admin" as const, userId: s.user.id } : null;
}

function failure(err: unknown): FormState {
  if (err instanceof AdminActionError || err instanceof UploadError) return { message: err.message };
  console.error("[admin] action failed", err);
  return { message: "Something went wrong. Check the server logs." };
}

const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* ---------------------------------- orders --------------------------------- */

export async function changeOrderStatusAction(orderId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  const to = z.enum(orderStatus.enumValues).safeParse(fd.get("to"));
  if (!to.success) return { errors: { to: "Choose a status" } };
  try {
    await changeOrderStatus(
      orderId,
      {
        to: to.data,
        note: str(fd, "note"),
        notifyCustomer: bool(fd.get("notify")),
        externalReference: str(fd, "externalReference"),
        infoRequestMessage: str(fd, "infoRequestMessage"),
        agentName: str(fd, "agentName"),
        agentAddress: str(fd, "agentAddress"),
      },
      actor,
    );
  } catch (err) {
    return failure(err);
  }
  // The quick-action form for this step disappears once the status moves on, so confirm on the page.
  redirect(`/admin/orders/${orderId}?updated=1`);
}

export async function refundOrderAction(orderId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  if (!bool(fd.get("confirm"))) return { errors: { confirm: "Tick the box to confirm the refund" } };
  try {
    await refundOrder(orderId, { note: str(fd, "note") }, actor);
  } catch (err) {
    return failure(err);
  }
  redirect(`/admin/orders/${orderId}?updated=refunded`);
}

export async function updateProviderOrderAction(providerOrderId: string, orderId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  const raw = str(fd, "status");
  const status = raw ? z.enum(providerOrderStatus.enumValues).safeParse(raw) : null;
  if (status && !status.success) return { errors: { status: "Choose a status" } };
  try {
    await updateProviderOrder(providerOrderId, { externalReference: str(fd, "externalReference"), status: status?.data, note: str(fd, "note") }, actor);
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Saved." };
}

export async function addNoteAction(target: { orderId?: string; customerId?: string; entityId?: string; supportRequestId?: string }, _prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  try {
    await addAdminNote(target, str(fd, "body"), actor);
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Note added." };
}

export async function closeRequestAction(requestId: string, orderId: string): Promise<void> {
  const actor = await admin();
  if (!actor) return;
  await closeInformationRequest(requestId, actor);
  revalidatePath(`/admin/orders/${orderId}`);
}

/* -------------------------------- documents -------------------------------- */

export async function uploadAdminDocumentAction(
  target: { customerId: string; entityId?: string | null; orderId?: string | null },
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  const type = z.enum(documentType.enumValues).safeParse(fd.get("type"));
  if (!type.success) return { errors: { type: "Choose a document type" } };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: { file: "Choose a file" } };
  try {
    await uploadAdminDocument(
      {
        ...target,
        type: type.data,
        title: str(fd, "title"),
        file,
        visibility: fd.get("visibility") === "internal" ? "internal" : "customer",
        notifyCustomer: bool(fd.get("notify")),
      },
      actor,
    );
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Document uploaded." };
}

export async function setDocumentStateAction(documentId: string, patch: { visibility?: "customer" | "internal"; status?: "available" | "archived" }): Promise<void> {
  const actor = await admin();
  if (!actor) return;
  await setDocumentState(documentId, patch, actor);
  revalidatePath("/admin", "layout");
}

/* --------------------------------- entities -------------------------------- */

export async function activateServiceAction(entityServiceId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  try {
    await activateEntityService(entityServiceId, { agentName: str(fd, "agentName"), agentAddress: str(fd, "agentAddress") }, bool(fd.get("notify")), actor);
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Service updated." };
}

export async function updateEntityAction(entityId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  const status = z.enum(entityStatus.enumValues).safeParse(fd.get("status"));
  if (!status.success) return { errors: { status: "Choose a status" } };
  const formationDate = str(fd, "formationDate");
  if (formationDate && !/^\d{4}-\d{2}-\d{2}$/.test(formationDate)) return { errors: { formationDate: "Use the date picker" } };
  const legalName = str(fd, "legalName");
  if (!legalName) return { errors: { legalName: "Legal name is required" } };
  try {
    await updateEntityRecord(entityId, { status: status.data, sosFileNumber: str(fd, "sosFileNumber") || null, formationDate: formationDate || null, legalName }, actor);
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/admin/entities/${entityId}`);
  return { ok: true, message: "Entity saved." };
}

/* --------------------------------- support --------------------------------- */

export async function setSupportStatusAction(id: string, status: "open" | "pending" | "closed"): Promise<void> {
  const actor = await admin();
  if (!actor) return;
  await setSupportStatus(id, status, actor);
  revalidatePath("/admin/support", "layout");
}

/* --------------------------------- settings -------------------------------- */

export async function saveSiteSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  const raw = formDataToObject(fd) as Record<string, unknown> & { legal?: { reviewed?: Record<string, unknown> } };
  // Unchecked boxes aren't submitted; list every legal doc explicitly.
  const reviewed: Record<string, boolean> = {};
  for (const slug of String(fd.get("legalSlugs") ?? "").split(",").filter(Boolean)) reviewed[slug] = fd.get(`legal.reviewed.${slug}`) === "on";
  raw.legal = { ...(raw.legal ?? {}), reviewed };
  const parsed = siteSettingsSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), message: "Please fix the highlighted fields." };
  await saveSiteSettings(parsed.data, actor);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. Changes are live." };
}

export async function saveServiceAction(serviceId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await admin();
  if (!actor) return DENIED;
  const price = parseDollarsToCents(str(fd, "price") || "0");
  const gov = parseDollarsToCents(str(fd, "governmentFee") || "0");
  if (price === null) return { errors: { price: "Enter a dollar amount like 99 or 99.00" } };
  if (gov === null) return { errors: { governmentFee: "Enter a dollar amount like 300" } };
  const statesRaw = str(fd, "availableStates");
  const parsed = serviceSchema.safeParse({
    name: str(fd, "name"),
    shortDescription: str(fd, "shortDescription"),
    priceCents: price,
    governmentFeeCents: gov,
    governmentFeeLabel: str(fd, "governmentFeeLabel"),
    billing: str(fd, "billing") || "one_time",
    isActive: bool(fd.get("isActive")),
    features: str(fd, "features").split("\n").map((l) => l.trim()).filter(Boolean),
    availableStates: fd.has("availableStates") ? statesRaw.split(/[\s,]+/).map((s) => s.toUpperCase()).filter((s) => STATE_CODES.includes(s)) : undefined,
  });
  if (!parsed.success) return { errors: zodErrors(parsed.error), message: "Please fix the highlighted fields." };
  if (parsed.data.isActive && parsed.data.priceCents === 0) return { errors: { price: "Set a price before activating this service" } };
  await saveService(serviceId, parsed.data, actor);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. New prices apply to new orders; existing subscriptions keep their price." };
}

