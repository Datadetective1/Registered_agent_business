import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditEvents, entities, entityServices, informationRequests, notifications, orders, providerOrders, subscriptions } from "@/db/schema";
import { parseForm } from "@/lib/forms";
import { registeredAgentIntakeSchema } from "@/lib/intake";
import { AdminActionError, changeOrderStatus, uploadAdminDocument } from "@/server/admin/operations";
import { SYSTEM } from "@/server/audit";
import { CustomerActionError, getCustomerEntity, getCustomerOrderDetail, respondToInformationRequest, setSubscriptionAutoRenew } from "@/server/customer";
import { canAccessDocument, listCustomerDocuments } from "@/server/documents";
import { confirmOrderPayment, submitOrderIntake } from "@/server/fulfillment";
import { createPendingOrder, quoteOrder } from "@/server/orders";
import { resetDb } from "../helpers/db";
import { makeAdmin, makeCustomer, raIntakeFormData, seedCatalog } from "../helpers/fixtures";

const PDF = new File([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF")], "certificate.pdf", { type: "application/pdf" });

async function readyRaOrder() {
  const { customer } = await makeCustomer();
  const quote = await quoteOrder("registered_agent");
  const order = await createPendingOrder({
    customerId: customer.id,
    type: "registered_agent",
    entityId: null,
    checkoutData: { entity: { legalName: "Boundary Co LLC", entityType: "llc", jurisdiction: "TX" } },
    quote,
    termsVersion: "t",
  });
  await confirmOrderPayment({ orderId: order.id, gateway: "simulated", amountTotalCents: 9900, currency: "usd" }, SYSTEM);
  const parsed = parseForm(registeredAgentIntakeSchema, raIntakeFormData({ "entity.legalName": "Boundary Co LLC" }));
  if (!parsed.ok) throw new Error("fixture");
  const ready = await submitOrderIntake(customer, order.id, { type: "registered_agent", data: parsed.data }, SYSTEM);
  return { customer, order: ready };
}

beforeEach(async () => {
  await resetDb();
  await seedCatalog();
});

describe("admin fulfillment workflow", () => {
  it("runs ready → submitted → processing → completed with side effects", async () => {
    const { actor } = await makeAdmin();
    const { customer, order } = await readyRaOrder();

    await expect(changeOrderStatus(order.id, { to: "completed", notifyCustomer: true }, actor)).rejects.toBeInstanceOf(AdminActionError); // not allowed from ready
    await expect(changeOrderStatus(order.id, { to: "submitted_to_provider", notifyCustomer: true }, actor)).rejects.toThrow(/reference/);

    await changeOrderStatus(order.id, { to: "submitted_to_provider", notifyCustomer: true, externalReference: "RAI-12345", note: "Placed in partner dashboard" }, actor);
    const [po] = await db.select().from(providerOrders).where(eq(providerOrders.orderId, order.id));
    expect(po.status).toBe("submitted");
    expect(po.externalReference).toBe("RAI-12345");
    expect(po.submittedByUserId).toBe(actor.userId);

    await changeOrderStatus(order.id, { to: "processing", notifyCustomer: false }, actor);
    await expect(changeOrderStatus(order.id, { to: "completed", notifyCustomer: true }, actor)).rejects.toThrow(/registered agent name/);
    await uploadAdminDocument({ customerId: customer.id, entityId: order.entityId, orderId: order.id, type: "state_correspondence", title: "RA confirmation", file: PDF, visibility: "customer", notifyCustomer: false }, actor);
    await changeOrderStatus(order.id, { to: "completed", notifyCustomer: true, agentName: "Partner Registered Agent, Inc.", agentAddress: "700 Lavaca St Ste 1401, Austin, TX 78701" }, actor);

    const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(o.status).toBe("completed");
    expect(o.completedAt).toBeTruthy();
    const [es] = await db.select().from(entityServices).where(eq(entityServices.orderId, order.id));
    expect(es.status).toBe("active");
    expect(es.details.agentName).toBe("Partner Registered Agent, Inc.");

    const templates = (await db.select().from(notifications).where(eq(notifications.customerId, customer.id))).map((n) => n.template);
    expect(templates).toEqual(expect.arrayContaining(["provider_submitted", "order_completed", "service_activated"]));
    const statusEvents = await db.select().from(auditEvents).where(eq(auditEvents.action, "order.status_changed"));
    expect(statusEvents).toHaveLength(3);
  });

  it("information requests notify the customer and accept a response with files", async () => {
    const { actor } = await makeAdmin();
    const { customer, order } = await readyRaOrder();
    await changeOrderStatus(order.id, { to: "information_needed", notifyCustomer: false, infoRequestMessage: "Please upload your certificate of formation." }, actor);
    const [req] = await db.select().from(informationRequests).where(eq(informationRequests.orderId, order.id));
    expect((await db.select().from(notifications).where(eq(notifications.template, "information_requested"))).length).toBe(1);

    await respondToInformationRequest(customer, req.id, "Attached.", [PDF], { type: "customer", userId: customer.userId });
    const [after] = await db.select().from(informationRequests).where(eq(informationRequests.id, req.id));
    expect(after.status).toBe("responded");
    const docs = await listCustomerDocuments(customer.id, { orderId: order.id });
    expect(docs).toHaveLength(1);
    expect(docs[0].informationRequestId).toBe(req.id);
    expect(docs[0].mimeType).toBe("application/pdf");
    await expect(respondToInformationRequest(customer, req.id, "again", [], { type: "customer", userId: customer.userId })).rejects.toBeInstanceOf(CustomerActionError);
  });

  it("cancelling an order cancels its subscription and service", async () => {
    const { actor } = await makeAdmin();
    const { order } = await readyRaOrder();
    await changeOrderStatus(order.id, { to: "cancelled", notifyCustomer: false, note: "Customer asked to cancel" }, actor);
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orderId, order.id));
    expect(sub.status).toBe("canceled");
    const [es] = await db.select().from(entityServices).where(eq(entityServices.orderId, order.id));
    expect(es.status).toBe("cancelled");
    const [po] = await db.select().from(providerOrders).where(eq(providerOrders.orderId, order.id));
    expect(po.status).toBe("cancelled");
  });

  it("rejects uploads to an entity owned by another customer", async () => {
    const { actor } = await makeAdmin();
    const a = await readyRaOrder();
    const b = await makeCustomer();
    await expect(
      uploadAdminDocument({ customerId: b.customer.id, entityId: a.order.entityId, type: "other", title: "x", file: PDF, visibility: "customer", notifyCustomer: false }, actor),
    ).rejects.toBeInstanceOf(AdminActionError);
  });

  it("rejects files that aren't PDFs or images, regardless of extension", async () => {
    const { actor } = await makeAdmin();
    const { customer, order } = await readyRaOrder();
    const fake = new File([Buffer.from("<script>alert(1)</script>")], "evil.pdf", { type: "application/pdf" });
    await expect(uploadAdminDocument({ customerId: customer.id, entityId: order.entityId, type: "other", title: "x", file: fake, visibility: "customer", notifyCustomer: false }, actor)).rejects.toThrow(/PDF or an image/);
  });
});

describe("customer data boundaries", () => {
  it("one customer can never read another customer's order, entity or documents", async () => {
    const { actor } = await makeAdmin();
    const a = await readyRaOrder();
    const b = await makeCustomer();
    const doc = await uploadAdminDocument({ customerId: a.customer.id, entityId: a.order.entityId, orderId: a.order.id, type: "service_of_process", title: "Lawsuit", file: PDF, visibility: "customer", notifyCustomer: true }, actor);
    const internal = await uploadAdminDocument({ customerId: a.customer.id, entityId: a.order.entityId, type: "other", title: "Internal memo", file: PDF, visibility: "internal", notifyCustomer: true }, actor);

    expect(await getCustomerOrderDetail(b.customer.id, a.order.id)).toBeNull();
    expect(await getCustomerEntity(b.customer.id, a.order.entityId!)).toBeNull();
    expect(await listCustomerDocuments(b.customer.id)).toHaveLength(0);

    expect(canAccessDocument(doc, { role: "customer", customerId: a.customer.id })).toBe(true);
    expect(canAccessDocument(doc, { role: "customer", customerId: b.customer.id })).toBe(false);
    expect(canAccessDocument(internal, { role: "customer", customerId: a.customer.id })).toBe(false);
    expect(canAccessDocument(internal, { role: "admin", customerId: null })).toBe(true);

    // Internal docs never notify or list for the customer; urgent docs send the "important" email.
    const mails = await db.select().from(notifications).where(eq(notifications.template, "new_document"));
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toMatch(/^Important/);
    expect((await listCustomerDocuments(a.customer.id)).map((d) => d.title)).toEqual(["Lawsuit"]);
  });

  it("customers can only change their own subscriptions; turning off renewal schedules the end", async () => {
    const a = await readyRaOrder();
    const b = await makeCustomer();
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orderId, a.order.id));
    await expect(setSubscriptionAutoRenew(b.customer, sub.id, false, SYSTEM)).rejects.toBeInstanceOf(CustomerActionError);

    await db.update(entityServices).set({ status: "active" }).where(eq(entityServices.orderId, a.order.id));
    await setSubscriptionAutoRenew(a.customer, sub.id, false, SYSTEM);
    const [after] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
    expect(after.cancelAtPeriodEnd).toBe(true);
    const [es] = await db.select().from(entityServices).where(eq(entityServices.orderId, a.order.id));
    expect(es.status).toBe("cancellation_scheduled");
    const templates = (await db.select().from(notifications)).map((n) => n.template);
    expect(templates).toEqual(expect.arrayContaining(["renewal_cancelled", "admin_renewal_cancelled"]));

    await setSubscriptionAutoRenew(a.customer, sub.id, true, SYSTEM);
    expect((await db.select().from(entityServices).where(eq(entityServices.orderId, a.order.id)))[0].status).toBe("active");
    const [ent] = await db.select().from(entities).where(eq(entities.id, a.order.entityId!));
    expect(ent.customerId).toBe(a.customer.id);
  });
});
