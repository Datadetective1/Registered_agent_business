"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/forms";
import { SUPPORT_CATEGORY_LABEL } from "@/lib/labels";
import { submitContact } from "./actions";

export function ContactForm({ defaults }: { defaults: { name?: string; email?: string; category?: string; subject?: string } }) {
  const [state, action] = useActionState<FormState, FormData>(submitContact, {});
  if (state.ok) {
    return (
      <Alert tone="success" title="Message sent" role="status">
        {state.message}
      </Alert>
    );
  }
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Your name" autoComplete="name" required defaultValue={v.name ?? defaults.name} error={e.name} />
        <TextField name="email" label="Email" type="email" autoComplete="email" required defaultValue={v.email ?? defaults.email} error={e.email} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="phone" label="Phone" type="tel" autoComplete="tel" optional defaultValue={v.phone} error={e.phone} />
        <SelectField
          name="category"
          label="Topic"
          defaultValue={v.category ?? defaults.category ?? "general"}
          options={Object.entries(SUPPORT_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
          error={e.category}
        />
      </div>
      <TextField name="subject" label="Subject" required defaultValue={v.subject ?? defaults.subject} error={e.subject} />
      <TextAreaField name="message" label="Message" rows={6} required defaultValue={v.message} error={e.message} hint="Please don't include ID numbers or other sensitive information." />
      {/* Honeypot (hidden from people and assistive tech). */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton size="lg" pendingLabel="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
