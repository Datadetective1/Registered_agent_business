import "server-only";
import { z } from "zod";
import { db } from "@/db";
import { supportRequests } from "@/db/schema";
import { email, optionalPhone, optionalText, text } from "@/lib/forms";
import { SUPPORT_CATEGORY_LABEL } from "@/lib/labels";
import { audit, type Actor } from "./audit";
import { notifyAdmins, sendEmail } from "./notifications/send";

export const SUPPORT_CATEGORIES = ["general", "sales", "billing", "documents", "order", "registered_agent", "other"] as const;

export const supportRequestSchema = z.object({
  name: text(120, "Name"),
  email: email(),
  phone: optionalPhone(),
  category: z.enum(SUPPORT_CATEGORIES).default("general"),
  subject: text(150, "Subject"),
  message: z.string({ error: "Message is required" }).trim().min(10, "Please add a little more detail").max(5000, "Message is too long"),
  orderId: optionalText(40),
  entityId: optionalText(40),
});
export type SupportRequestInput = z.infer<typeof supportRequestSchema>;

export async function createSupportRequest(
  input: SupportRequestInput,
  opts: { customerId: string | null; source: "contact_form" | "account"; actor: Actor },
) {
  const [row] = await db
    .insert(supportRequests)
    .values({
      customerId: opts.customerId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      category: input.category,
      subject: input.subject,
      message: input.message,
      source: opts.source,
      orderId: input.orderId ?? null,
      entityId: input.entityId ?? null,
    })
    .returning();
  await audit({ actor: opts.actor, action: "support.created", targetType: "support_request", targetId: row.id, customerId: opts.customerId });
  await sendEmail({ template: "support_received", to: input.email, data: { name: input.name, subject: input.subject }, customerId: opts.customerId });
  await notifyAdmins(
    "admin_support_request",
    {
      id: row.id,
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      category: SUPPORT_CATEGORY_LABEL[input.category] ?? input.category,
    },
    { customerId: opts.customerId },
  );
  return row;
}
