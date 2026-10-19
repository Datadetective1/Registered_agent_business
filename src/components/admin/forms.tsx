"use client";

import { useActionState, useState } from "react";
import {
  activateServiceAction,
  addNoteAction,
  changeOrderStatusAction,
  refundOrderAction,
  saveServiceAction,
  saveSiteSettingsAction,
  updateEntityAction,
  updateProviderOrderAction,
  uploadAdminDocumentAction,
} from "@/app/admin/actions";
import { Alert } from "@/components/ui/alert";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/forms";
import { DOCUMENT_TYPE_LABEL, ENTITY_STATUS_LABEL } from "@/lib/labels";
import type { OrderStatus } from "@/db/schema";

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <Alert tone={state.ok ? "success" : "danger"} role={state.ok ? "status" : "alert"}>
      {state.message}
    </Alert>
  );
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.heic";

/* ---------------------------------- orders --------------------------------- */

type QuickAction = "information_needed" | "ready_for_fulfillment" | "submitted_to_provider" | "processing" | "completed" | "cancelled";

const QUICK_LABEL: Record<QuickAction, string> = {
  information_needed: "Request information",
  ready_for_fulfillment: "Mark ready for provider",
  submitted_to_provider: "Mark submitted to provider",
  processing: "Mark processing",
  completed: "Mark completed",
  cancelled: "Cancel order",
};

/**
 * One explicit button per next step (no status dropdown). Steps that need input open
 * a short form; destructive ones ask for confirmation.
 */
export function OrderQuickActions({
  orderId,
  allowed,
  needsAgentDetails,
  hasIntake,
  refund,
}: {
  orderId: string;
  allowed: OrderStatus[];
  needsAgentDetails: boolean;
  hasIntake: boolean;
  /** null when the order can't be refunded from here; otherwise a note about how. */
  refund: { available: boolean; note: string } | null;
}) {
  const [open, setOpen] = useState<QuickAction | "refund" | null>(null);
  const actions = (Object.keys(QUICK_LABEL) as QuickAction[]).filter((a) => allowed.includes(a));
  const primary = actions.filter((a) => a !== "cancelled");
  if (!actions.length && !refund) return <p className="text-sm text-muted">No further steps for this order.</p>;
  return (
    <div className="space-y-3">
      {primary.map((a, i) => (
        <QuickActionForm key={a} orderId={orderId} action={a} first={i === 0} open={open === a} onToggle={() => setOpen(open === a ? null : a)} needsAgentDetails={needsAgentDetails} hasIntake={hasIntake} />
      ))}
      {actions.includes("cancelled") || refund ? (
        <div className={primary.length ? "space-y-3 border-t border-line pt-3" : "space-y-3"}>
          {actions.includes("cancelled") ? (
            <QuickActionForm orderId={orderId} action="cancelled" first={false} open={open === "cancelled"} onToggle={() => setOpen(open === "cancelled" ? null : "cancelled")} needsAgentDetails={false} hasIntake={hasIntake} />
          ) : null}
          {refund ? <RefundForm orderId={orderId} refund={refund} open={open === "refund"} onToggle={() => setOpen(open === "refund" ? null : "refund")} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function QuickActionForm({
  orderId,
  action,
  first,
  open,
  onToggle,
  needsAgentDetails,
  hasIntake,
}: {
  orderId: string;
  action: QuickAction;
  first: boolean;
  open: boolean;
  onToggle: () => void;
  needsAgentDetails: boolean;
  hasIntake: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(changeOrderStatusAction.bind(null, orderId), {});
  const danger = action === "cancelled";
  const oneClick = action === "processing" || (action === "ready_for_fulfillment" && hasIntake);
  if (oneClick) {
    return (
      <form action={formAction} className="space-y-2">
        <Message state={state} />
        <input type="hidden" name="to" value={action} />
        <SubmitButton variant={first ? "primary" : "secondary"} className="w-full" pendingLabel="Updating…">
          {QUICK_LABEL[action]}
        </SubmitButton>
      </form>
    );
  }
  return (
    <div className={open ? "rounded-md border border-line bg-paper p-3" : undefined}>
      <Button variant={danger ? "ghost" : first && !open ? "primary" : "secondary"} className={danger ? "w-full text-danger-fg" : "w-full"} onClick={onToggle} aria-expanded={open}>
        {QUICK_LABEL[action]}
      </Button>
      {open ? (
        <form action={formAction} className="mt-3 space-y-3">
          <Message state={state} />
          <input type="hidden" name="to" value={action} />
          {action === "ready_for_fulfillment" && !hasIntake ? (
            <Alert tone="warning">The customer hasn&apos;t submitted onboarding, so there&apos;s no provider entry sheet yet.</Alert>
          ) : null}
          {action === "information_needed" ? (
            <TextAreaField id={`qa-${orderId}-message`} name="infoRequestMessage" label="What do you need from the customer?" rows={4} hint="Emailed to the customer and shown in their account. They can reply and upload files." />
          ) : null}
          {action === "submitted_to_provider" ? (
            <TextField id={`qa-${orderId}-ref`} name="externalReference" label="Provider order / reference #" hint="From the partner's dashboard after you place the order." />
          ) : null}
          {action === "completed" && needsAgentDetails ? (
            <>
              <TextField id={`qa-${orderId}-agent-name`} name="agentName" label="Registered agent name (as listed with the state)" />
              <TextAreaField id={`qa-${orderId}-agent-address`} name="agentAddress" label="Registered office address" rows={2} />
            </>
          ) : null}
          {danger ? (
            <Alert tone="warning">Cancels the order, its services and any auto-renewal. It does not refund the payment; use Refund for that.</Alert>
          ) : null}
          <TextAreaField id={`qa-${orderId}-${action}-note`} name="note" label="Internal note" optional rows={2} />
          {action === "submitted_to_provider" || action === "completed" ? (
            <CheckboxField id={`qa-${orderId}-${action}-notify`} name="notify" label="Email the customer about this update" defaultChecked />
          ) : null}
          <SubmitButton variant={danger ? "danger" : "primary"} size="sm" pendingLabel="Updating…">
            {action === "information_needed" ? "Send request" : danger ? "Cancel this order" : "Confirm"}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

function RefundForm({ orderId, refund, open, onToggle }: { orderId: string; refund: { available: boolean; note: string }; open: boolean; onToggle: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(refundOrderAction.bind(null, orderId), {});
  return (
    <div className={open ? "rounded-md border border-line bg-paper p-3" : undefined}>
      <Button variant="ghost" className="w-full text-danger-fg" onClick={onToggle} aria-expanded={open}>
        Refund
      </Button>
      {open ? (
        refund.available ? (
          <form action={action} className="mt-3 space-y-3">
            <Message state={state} />
            <p className="text-sm text-muted">{refund.note}</p>
            <TextAreaField id={`refund-${orderId}-note`} name="note" label="Internal note" optional rows={2} />
            <CheckboxField id={`refund-${orderId}-confirm`} name="confirm" label="Refund the full amount and cancel this order's services" error={state.errors?.confirm} />
            <SubmitButton variant="danger" size="sm" pendingLabel="Refunding…">
              Refund order
            </SubmitButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">{refund.note}</p>
        )
      ) : null}
    </div>
  );
}

const PROVIDER_NEXT: Record<string, Array<{ value: string; label: string }>> = {
  pending_manual: [{ value: "submitted", label: "Submitted" }, { value: "cancelled", label: "Cancelled (not needed)" }],
  submitted: [{ value: "processing", label: "Processing" }, { value: "completed", label: "Completed" }, { value: "failed", label: "Failed" }, { value: "cancelled", label: "Cancelled" }],
  processing: [{ value: "completed", label: "Completed" }, { value: "failed", label: "Failed" }, { value: "cancelled", label: "Cancelled" }],
  failed: [{ value: "submitted", label: "Resubmitted" }, { value: "cancelled", label: "Cancelled" }],
};

/** Add or edit a provider reference, and (for change-of-agent filings) move the filing along. */
export function ProviderOrderForm({
  providerOrderId,
  orderId,
  status,
  reference,
  allowStatus,
}: {
  providerOrderId: string;
  orderId: string;
  status: string;
  reference: string | null;
  allowStatus: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateProviderOrderAction.bind(null, providerOrderId, orderId), {});
  const next = allowStatus ? (PROVIDER_NEXT[status] ?? []) : [];
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="space-y-3 sm:col-span-2">
        <Message state={state} />
      </div>
      <TextField id={`po-${providerOrderId}-ref`} name="externalReference" label="Provider reference / filing #" defaultValue={reference ?? ""} />
      {next.length ? (
        <SelectField id={`po-${providerOrderId}-status`} name="status" label="Move to" placeholder="(no change)" options={next} defaultValue="" error={state.errors?.status} />
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="sm:col-span-2">
        <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}

export function NoteForm({ target }: { target: { orderId?: string; customerId?: string; entityId?: string; supportRequestId?: string } }) {
  const [state, action] = useActionState<FormState, FormData>(addNoteAction.bind(null, target), {});
  return (
    <form action={action} className="space-y-3">
      <Message state={state} />
      <TextAreaField name="body" label="Add an internal note" rows={3} hint="Never shown to the customer." />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
        Add note
      </SubmitButton>
    </form>
  );
}

export function AdminUploadForm({ target, defaultType = "formation_document" }: { target: { customerId: string; entityId?: string | null; orderId?: string | null }; defaultType?: string }) {
  const [state, action] = useActionState<FormState, FormData>(uploadAdminDocumentAction.bind(null, target), {});
  const [visibility, setVisibility] = useState("customer");
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="type" label="Document type" defaultValue={defaultType} options={Object.entries(DOCUMENT_TYPE_LABEL).map(([value, label]) => ({ value, label }))} error={state.errors?.type} />
        <SelectField
          name="visibility"
          label="Visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          options={[
            { value: "customer", label: "Customer can see it" },
            { value: "internal", label: "Internal only" },
          ]}
        />
      </div>
      <TextField name="title" label="Title" placeholder="e.g. Filed Certificate of Formation" />
      <div>
        <label htmlFor="admin-file" className="mb-1.5 block text-sm font-medium">
          File
        </label>
        <input id="admin-file" name="file" type="file" accept={ACCEPT} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm" />
        {state.errors?.file ? <p className="mt-1.5 text-sm text-danger-fg">{state.errors.file}</p> : null}
      </div>
      {visibility === "customer" ? <CheckboxField name="notify" label="Email the customer that a new document is available" defaultChecked /> : null}
      <SubmitButton variant="secondary" pendingLabel="Uploading…">
        Upload
      </SubmitButton>
    </form>
  );
}

/* --------------------------------- entities -------------------------------- */

export function ActivateServiceForm({ entityServiceId, isRegisteredAgent, defaults }: { entityServiceId: string; isRegisteredAgent: boolean; defaults: { agentName?: string; agentAddress?: string } }) {
  const [state, action] = useActionState<FormState, FormData>(activateServiceAction.bind(null, entityServiceId), {});
  return (
    <form action={action} className="space-y-3">
      <Message state={state} />
      {isRegisteredAgent ? (
        <>
          <TextField name="agentName" label="Registered agent name" defaultValue={defaults.agentName} />
          <TextAreaField name="agentAddress" label="Registered office address" rows={2} defaultValue={defaults.agentAddress} />
        </>
      ) : null}
      <CheckboxField name="notify" label="Email the customer" defaultChecked />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
        Save and activate
      </SubmitButton>
    </form>
  );
}

export function EntityEditForm({ entityId, defaults }: { entityId: string; defaults: { legalName: string; status: string; sosFileNumber: string; formationDate: string } }) {
  const [state, action] = useActionState<FormState, FormData>(updateEntityAction.bind(null, entityId), {});
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <TextField name="legalName" label="Legal name" defaultValue={defaults.legalName} error={state.errors?.legalName} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField name="status" label="Status" defaultValue={defaults.status} options={Object.entries(ENTITY_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        <TextField name="sosFileNumber" label="SOS file number" optional defaultValue={defaults.sosFileNumber} />
        <TextField name="formationDate" label="Formation date" type="date" optional defaultValue={defaults.formationDate} error={state.errors?.formationDate} />
      </div>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
        Save entity
      </SubmitButton>
    </form>
  );
}

/* --------------------------------- settings -------------------------------- */

export function SiteSettingsForm({ values, legalDocs }: { values: Record<string, string>; legalDocs: Array<{ slug: string; title: string }> }) {
  const [state, action] = useActionState<FormState, FormData>(saveSiteSettingsAction, {});
  const e = state.errors ?? {};
  const v = (k: string) => values[k] ?? "";
  const section = "space-y-4 rounded-lg border border-line bg-surface p-5";
  return (
    <form action={action} className="space-y-6">
      <Message state={state} />
      <fieldset className={section}>
        <legend className="px-1 text-sm font-semibold">Brand</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="brand.name" label="Company name (public)" defaultValue={v("brand.name")} error={e["brand.name"]} />
          <TextField name="brand.legalName" label="Legal entity name" defaultValue={v("brand.legalName")} error={e["brand.legalName"]} />
        </div>
        <TextField name="brand.tagline" label="Tagline" defaultValue={v("brand.tagline")} error={e["brand.tagline"]} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="brand.monogram" label="Monogram" hint="Shown when there's no logo." defaultValue={v("brand.monogram")} error={e["brand.monogram"]} />
          <TextField className="sm:col-span-2" name="brand.logoUrl" label="Logo URL" optional hint="e.g. /brand/logo.svg (put the file in /public/brand)" defaultValue={v("brand.logoUrl")} error={e["brand.logoUrl"]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="colors.primary" label="Primary color" defaultValue={v("colors.primary")} error={e["colors.primary"]} />
          <TextField name="colors.primaryHover" label="Primary hover" defaultValue={v("colors.primaryHover")} error={e["colors.primaryHover"]} />
          <TextField name="colors.accent" label="Accent color" defaultValue={v("colors.accent")} error={e["colors.accent"]} />
        </div>
      </fieldset>
      <fieldset className={section}>
        <legend className="px-1 text-sm font-semibold">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="contact.supportEmail" label="Support email" defaultValue={v("contact.supportEmail")} error={e["contact.supportEmail"]} />
          <TextField name="contact.supportPhone" label="Support phone" optional defaultValue={v("contact.supportPhone")} />
          <TextField name="contact.supportHours" label="Support hours" defaultValue={v("contact.supportHours")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-6">
          <TextField className="sm:col-span-3" name="contact.address.line1" label="Company address" optional defaultValue={v("contact.address.line1")} />
          <TextField className="sm:col-span-3" name="contact.address.line2" label="Line 2" optional defaultValue={v("contact.address.line2")} />
          <TextField className="sm:col-span-3" name="contact.address.city" label="City" optional defaultValue={v("contact.address.city")} />
          <TextField className="sm:col-span-1" name="contact.address.state" label="State" optional defaultValue={v("contact.address.state")} />
          <TextField className="sm:col-span-2" name="contact.address.postalCode" label="ZIP" optional defaultValue={v("contact.address.postalCode")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="social.linkedin" label="LinkedIn URL" optional defaultValue={v("social.linkedin")} />
          <TextField name="social.x" label="X URL" optional defaultValue={v("social.x")} />
          <TextField name="social.facebook" label="Facebook URL" optional defaultValue={v("social.facebook")} />
        </div>
      </fieldset>
      <fieldset className={section}>
        <legend className="px-1 text-sm font-semibold">Registered agent messaging</legend>
        <TextField
          name="registeredAgent.agentOfRecordName"
          label="Registered agent of record (wholesale partner)"
          optional
          hint="Shown in disclosures as the company listed on state records. Leave empty to say “our nationwide registered agent partner”."
          defaultValue={v("registeredAgent.agentOfRecordName")}
        />
        <TextAreaField name="registeredAgent.renewalMessage" label="Renewal message" rows={2} defaultValue={v("registeredAgent.renewalMessage")} error={e["registeredAgent.renewalMessage"]} />
        <TextAreaField
          name="registeredAgent.changeOfAgentMessage"
          label="Change-of-agent message"
          rows={3}
          hint="Shown to customers switching from another agent. Keep it accurate to how you handle change filings (included, extra charge, or customer files)."
          defaultValue={v("registeredAgent.changeOfAgentMessage")}
          error={e["registeredAgent.changeOfAgentMessage"]}
        />
      </fieldset>
      <fieldset className={section}>
        <legend className="px-1 text-sm font-semibold">Operations</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="operations.adminNotificationEmail" label="Internal alerts email" defaultValue={v("operations.adminNotificationEmail")} error={e["operations.adminNotificationEmail"]} />
          <TextField name="operations.renewalReminderDays" label="Renewal reminders (days before)" hint="Comma-separated, e.g. 30, 7" defaultValue={v("operations.renewalReminderDays")} error={e["operations.renewalReminderDays"]} />
          <SelectField name="operations.fulfillmentProvider" label="Fulfillment provider" defaultValue="manual" options={[{ value: "manual", label: "Manual (partner dashboard)" }]} hint="API providers appear here once integrated." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="analytics.plausibleDomain" label="Privacy-friendly analytics domain" optional hint="Plausible-compatible. Leave empty to disable." defaultValue={v("analytics.plausibleDomain")} />
          <TextField name="analytics.plausibleScriptUrl" label="Analytics script URL" defaultValue={v("analytics.plausibleScriptUrl")} />
        </div>
      </fieldset>
      <fieldset className={section}>
        <legend className="px-1 text-sm font-semibold">Legal</legend>
        <Alert tone="warning">Only tick a document after a licensed attorney has reviewed it. Unreviewed documents show a draft notice on the site.</Alert>
        <input type="hidden" name="legalSlugs" value={legalDocs.map((d) => d.slug).join(",")} />
        <div className="grid gap-3 sm:grid-cols-2">
          {legalDocs.map((d) => (
            <CheckboxField key={d.slug} name={`legal.reviewed.${d.slug}`} label={`${d.title}: attorney-reviewed`} defaultChecked={values[`legal.reviewed.${d.slug}`] === "on"} />
          ))}
        </div>
        <TextField name="legal.termsVersion" label="Terms version" hint="Recorded on every order. Bump it when terms change." defaultValue={v("legal.termsVersion")} error={e["legal.termsVersion"]} />
      </fieldset>
      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  );
}

export function ServiceForm({
  serviceId,
  kind,
  values,
}: {
  serviceId: string;
  kind: "registered_agent" | "formation" | "business_address";
  values: { name: string; shortDescription: string; price: string; governmentFee: string; governmentFeeLabel: string; billing: string; isActive: boolean; features: string; availableStates: string };
}) {
  const [state, action] = useActionState<FormState, FormData>(saveServiceAction.bind(null, serviceId), {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Message state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name" defaultValue={values.name} error={e.name} />
        <TextField name="price" label={kind === "formation" ? "Service fee ($)" : "Price ($)"} defaultValue={values.price} error={e.price} inputMode="decimal" />
      </div>
      {kind === "formation" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="governmentFee" label="State filing fee ($)" defaultValue={values.governmentFee} error={e.governmentFee} inputMode="decimal" />
          <TextField name="governmentFeeLabel" label="State fee label" defaultValue={values.governmentFeeLabel} />
        </div>
      ) : (
        <input type="hidden" name="governmentFee" value="0" />
      )}
      {kind === "business_address" ? (
        <SelectField name="billing" label="Billing" defaultValue={values.billing} options={[{ value: "annual", label: "Annual" }, { value: "monthly", label: "Monthly" }]} />
      ) : (
        <input type="hidden" name="billing" value={values.billing} />
      )}
      <TextAreaField name="shortDescription" label="Short description" rows={2} defaultValue={values.shortDescription} />
      <TextAreaField name="features" label="Features shown to customers (one per line)" rows={6} defaultValue={values.features} hint={kind === "business_address" ? "List only capabilities that are actually available from your fulfillment partner." : undefined} error={e.features} />
      {kind === "registered_agent" ? (
        <TextField name="availableStates" label="Available states" hint="Two-letter codes, comma-separated (e.g. TX, OK). Only list states you can fulfill." defaultValue={values.availableStates} />
      ) : null}
      <CheckboxField name="isActive" label="Available for purchase" defaultChecked={values.isActive} />
      <SubmitButton variant="secondary" pendingLabel="Saving…">
        Save service
      </SubmitButton>
    </form>
  );
}
