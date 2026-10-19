"use client";

import { useActionState, useState } from "react";
import {
  changePasswordAction,
  respondToRequestAction,
  setAutoRenewAction,
  submitSupportAction,
  updateProfileAction,
  uploadDocumentAction,
} from "@/app/account/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/forms";
import { SUPPORT_CATEGORY_LABEL } from "@/lib/labels";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.heic,application/pdf,image/png,image/jpeg,image/webp,image/heic";
const ACCEPT_LABEL = "PDF, PNG, JPG, WEBP or HEIC, up to 15 MB";

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <Alert tone={state.ok ? "success" : "danger"} role={state.ok ? "status" : "alert"}>
      {state.message}
    </Alert>
  );
}

export function InfoRequestResponseForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState<FormState, FormData>(respondToRequestAction.bind(null, requestId), {});
  if (state.ok) return <Message state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Message state={state} />
      <TextAreaField name="response" label="Your reply" rows={4} optional defaultValue={state.values?.response} />
      <div>
        <label htmlFor={`files-${requestId}`} className="mb-1.5 block text-sm font-medium">
          Attach documents <span className="font-normal text-subtle">(optional)</span>
        </label>
        <input id={`files-${requestId}`} name="files" type="file" multiple accept={ACCEPT} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm" />
        <p className="mt-1.5 text-sm text-muted">{ACCEPT_LABEL}. Up to 5 files.</p>
      </div>
      <SubmitButton pendingLabel="Sending…">Send response</SubmitButton>
    </form>
  );
}

export function AutoRenewForm({ subscriptionId, autoRenew, endLabel }: { subscriptionId: string; autoRenew: boolean; endLabel: string }) {
  const [state, action] = useActionState<FormState, FormData>(setAutoRenewAction.bind(null, subscriptionId), {});
  const [confirming, setConfirming] = useState(false);
  if (state.ok) return <Message state={state} />;
  if (!autoRenew) {
    return (
      <form action={action} className="space-y-2">
        <Message state={state} />
        <input type="hidden" name="autoRenew" value="on" />
        <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
          Turn auto-renewal back on
        </SubmitButton>
      </form>
    );
  }
  if (!confirming) {
    return (
      <Button variant="link" className="text-sm text-danger-fg" onClick={() => setConfirming(true)}>
        Turn off auto-renewal
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-md border border-warning-fg/25 bg-warning-bg p-4">
      <Message state={state} />
      <input type="hidden" name="autoRenew" value="off" />
      <p className="text-sm leading-relaxed">
        Your service will continue until <strong>{endLabel}</strong> and then end. Most states require a business to keep a registered
        agent at all times, so you&apos;ll need to appoint a new one with the state before then.
      </p>
      <CheckboxField name="confirm" label="I understand and want to turn off auto-renewal." error={state.errors?.confirm} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" size="sm" pendingLabel="Saving…">
          Turn off auto-renewal
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Keep it on
        </Button>
      </div>
    </form>
  );
}

export function UploadDocumentForm({ entities, defaultEntityId }: { entities: Array<{ id: string; name: string }>; defaultEntityId?: string }) {
  const [state, action] = useActionState<FormState, FormData>(uploadDocumentAction, {});
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      action={async (fd) => {
        await action(fd);
        setKey((k) => k + 1);
      }}
      className="space-y-4"
      noValidate
    >
      <Message state={state} />
      {entities.length > 1 && !defaultEntityId ? (
        <SelectField name="entityId" label="Business" placeholder="Not specific to a business" options={entities.map((e) => ({ value: e.id, label: e.name }))} />
      ) : (
        <input type="hidden" name="entityId" value={defaultEntityId ?? entities[0]?.id ?? ""} />
      )}
      <TextField name="title" label="Description" optional placeholder="e.g. Signed operating agreement" />
      <div>
        <label htmlFor="upload-file" className="mb-1.5 block text-sm font-medium">
          File
        </label>
        <input id="upload-file" name="file" type="file" accept={ACCEPT} required className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm" />
        <p className="mt-1.5 text-sm text-muted">{ACCEPT_LABEL}.</p>
        {state.errors?.file ? <p className="mt-1.5 text-sm text-danger-fg">{state.errors.file}</p> : null}
      </div>
      <SubmitButton variant="secondary" pendingLabel="Uploading…">
        Upload document
      </SubmitButton>
    </form>
  );
}

export function ProfileForm({ defaults }: { defaults: Record<string, string> }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  const v = (k: string) => state.values?.[k] ?? defaults[k] ?? "";
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <Message state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label="First name" autoComplete="given-name" defaultValue={v("firstName")} error={e.firstName} />
        <TextField name="lastName" label="Last name" autoComplete="family-name" defaultValue={v("lastName")} error={e.lastName} />
      </div>
      <TextField name="email" label="Contact email" type="email" autoComplete="email" hint="Where we send order updates and document notices. Your sign-in email doesn't change." defaultValue={v("email")} error={e.email} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="phone" label="Phone" type="tel" optional autoComplete="tel" defaultValue={v("phone")} error={e.phone} />
        <TextField name="companyName" label="Company" optional autoComplete="organization" defaultValue={v("companyName")} error={e.companyName} />
      </div>
      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <Message state={state} />
      <TextField name="currentPassword" label="Current password" type="password" autoComplete="current-password" error={e.currentPassword} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="newPassword" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." error={e.newPassword} />
        <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" error={e.confirmPassword} />
      </div>
      <SubmitButton variant="secondary" pendingLabel="Saving…">
        Change password
      </SubmitButton>
    </form>
  );
}

export function SupportForm({ orders, entities }: { orders: Array<{ id: string; label: string }>; entities: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState<FormState, FormData>(submitSupportAction, {});
  if (state.ok) return <Message state={state} />;
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <Message state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="category" label="Topic" options={Object.entries(SUPPORT_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} defaultValue={v.category ?? "general"} />
        {orders.length ? <SelectField name="orderId" label="Related order" placeholder="None" options={orders.map((o) => ({ value: o.id, label: o.label }))} defaultValue={v.orderId} /> : null}
      </div>
      {entities.length ? <SelectField name="entityId" label="Related business" placeholder="None" options={entities.map((x) => ({ value: x.id, label: x.name }))} defaultValue={v.entityId} /> : null}
      <TextField name="subject" label="Subject" defaultValue={v.subject} error={e.subject} />
      <TextAreaField name="message" label="Message" rows={5} defaultValue={v.message} error={e.message} />
      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
    </form>
  );
}
