"use client";

import { useActionState, useState } from "react";
import { saveIntakeDraftAction, submitIntakeAction } from "@/app/account/actions";
import { Alert } from "@/components/ui/alert";
import { CheckboxField, Fieldset, RadioGroup, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { US_STATES } from "@/config/states";
import type { FormState } from "@/lib/forms";
import { APPOINTMENT_TYPES, LLC_DESIGNATORS } from "@/lib/intake";
import { ENTITY_TYPE_LABEL } from "@/lib/labels";

type Defaults = Record<string, string>;

const STATE_OPTIONS = US_STATES.map((s) => ({ value: s.code, label: s.name }));
const ENTITY_TYPE_OPTIONS = Object.entries(ENTITY_TYPE_LABEL).map(([value, label]) => ({ value, label }));

/** Value lookup: submitted values (after an error) win over saved defaults. */
function useField(state: FormState, defaults: Defaults) {
  const submitted = state.values;
  return {
    v: (name: string) => (submitted ? submitted[name] : defaults[name]) ?? "",
    checked: (name: string) => (submitted ? submitted[name] === "on" : defaults[name] === "on"),
    e: (name: string) => state.errors?.[name],
  };
}

function AddressFields({ prefix, f, stateHint }: { prefix: string; f: ReturnType<typeof useField>; stateHint?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <TextField className="sm:col-span-6" name={`${prefix}.line1`} label="Street address" autoComplete="address-line1" defaultValue={f.v(`${prefix}.line1`)} error={f.e(`${prefix}.line1`)} />
      <TextField className="sm:col-span-6" name={`${prefix}.line2`} label="Suite, unit, etc." optional autoComplete="address-line2" defaultValue={f.v(`${prefix}.line2`)} error={f.e(`${prefix}.line2`)} />
      <TextField className="sm:col-span-3" name={`${prefix}.city`} label="City" autoComplete="address-level2" defaultValue={f.v(`${prefix}.city`)} error={f.e(`${prefix}.city`)} />
      <SelectField
        className="sm:col-span-2"
        name={`${prefix}.state`}
        label="State"
        placeholder="Choose…"
        options={STATE_OPTIONS}
        defaultValue={f.v(`${prefix}.state`) || "TX"}
        error={f.e(`${prefix}.state`)}
        hint={stateHint}
      />
      <TextField className="sm:col-span-1" name={`${prefix}.postalCode`} label="ZIP" inputMode="numeric" autoComplete="postal-code" defaultValue={f.v(`${prefix}.postalCode`)} error={f.e(`${prefix}.postalCode`)} />
    </div>
  );
}

function ContactFields({ f, legend, description }: { f: ReturnType<typeof useField>; legend: string; description: string }) {
  return (
    <Fieldset legend={legend} description={description}>
      <TextField name="contact.name" label="Full name" autoComplete="name" defaultValue={f.v("contact.name")} error={f.e("contact.name")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="contact.email" label="Email" type="email" autoComplete="email" defaultValue={f.v("contact.email")} error={f.e("contact.email")} />
        <TextField name="contact.phone" label="Phone" type="tel" autoComplete="tel" defaultValue={f.v("contact.phone")} error={f.e("contact.phone")} />
      </div>
    </Fieldset>
  );
}

function FormFrame({
  orderId,
  state,
  action,
  children,
  submitLabel,
}: {
  orderId: string;
  state: FormState;
  action: (fd: FormData) => void;
  children: React.ReactNode;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-10" noValidate>
      {state.message ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}
      {children}
      <div className="space-y-3 border-t border-line pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton size="lg" pendingLabel="Saving…" className="w-full sm:w-auto">
            {submitLabel}
          </SubmitButton>
          <SubmitButton size="lg" variant="secondary" formAction={saveIntakeDraftAction.bind(null, orderId)} pendingLabel="Saving…" className="w-full sm:w-auto">
            Save and finish later
          </SubmitButton>
        </div>
        <p className="text-sm text-muted">You can edit this until your order is submitted for processing.</p>
      </div>
    </form>
  );
}

/* --------------------------- registered agent --------------------------- */

export function RegisteredAgentIntakeForm({ orderId, defaults }: { orderId: string; defaults: Defaults }) {
  const [state, action] = useActionState<FormState, FormData>(submitIntakeAction.bind(null, orderId), {});
  const f = useField(state, defaults);
  const [sameMailing, setSameMailing] = useState(f.checked("mailingSameAsPrincipal") || !f.v("mailingAddress.line1"));
  const [appointment, setAppointment] = useState(f.v("appointment.type"));

  return (
    <FormFrame orderId={orderId} state={state} action={action} submitLabel="Submit business information">
      <Fieldset legend="Business details" description="Enter these exactly as they appear in state records.">
        <TextField name="entity.legalName" label="Legal business name" defaultValue={f.v("entity.legalName")} error={f.e("entity.legalName")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="entity.entityType" label="Entity type" placeholder="Choose…" options={ENTITY_TYPE_OPTIONS} defaultValue={f.v("entity.entityType")} error={f.e("entity.entityType")} />
          <SelectField name="entity.jurisdiction" label="State of registration" options={STATE_OPTIONS} defaultValue={f.v("entity.jurisdiction") || "TX"} error={f.e("entity.jurisdiction")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="entity.sosFileNumber" label="Secretary of State file number" optional defaultValue={f.v("entity.sosFileNumber")} error={f.e("entity.sosFileNumber")} />
          <TextField name="entity.formationDate" label="Date formed" type="date" optional defaultValue={f.v("entity.formationDate")} error={f.e("entity.formationDate")} />
        </div>
      </Fieldset>

      <Fieldset legend="Principal office address" description="Where the business is run from. This is not the registered agent address.">
        <AddressFields prefix="principalAddress" f={f} />
      </Fieldset>

      <Fieldset legend="Mailing address">
        <CheckboxField name="mailingSameAsPrincipal" label="Same as principal office" checked={sameMailing} onChange={(e) => setSameMailing(e.target.checked)} />
        {!sameMailing ? <AddressFields prefix="mailingAddress" f={f} /> : null}
      </Fieldset>

      <ContactFields f={f} legend="Who should we notify?" description="We'll email this person when legal papers or state mail arrive. Keep it current." />

      <Fieldset legend="Your current registered agent">
        <div onChange={(e) => setAppointment((e.target as HTMLInputElement).value)}>
          <RadioGroup
            name="appointment.type"
            legend="Which best describes your situation?"
            defaultValue={appointment}
            error={f.e("appointment.type")}
            options={Object.entries(APPOINTMENT_TYPES).map(([value, label]) => ({ value, label }))}
          />
        </div>
        {appointment === "change_from_existing" ? (
          <TextField name="appointment.currentAgentName" label="Current registered agent's name" optional defaultValue={f.v("appointment.currentAgentName")} error={f.e("appointment.currentAgentName")} />
        ) : null}
        <p className="text-sm text-muted">
          Once your service is set up, your account will show the registered agent name and address to use with the state. If you&apos;re
          switching, the change takes effect when the state accepts your change-of-agent filing.
        </p>
      </Fieldset>

      <CheckboxField
        name="attestAuthorized"
        defaultChecked={f.checked("attestAuthorized")}
        error={f.e("attestAuthorized")}
        label="I am authorized to appoint a registered agent for this business, and the information above is accurate."
      />
    </FormFrame>
  );
}

/* ---------------------------- Texas LLC formation ---------------------------- */

export function LlcFormationIntakeForm({ orderId, defaults, ownAgent }: { orderId: string; defaults: Defaults; ownAgent: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(submitIntakeAction.bind(null, orderId), {});
  const f = useField(state, defaults);
  const initialPeople = Math.max(1, ...Object.keys(state.values ?? defaults).filter((k) => /^governingPersons\.\d+\.name$/.test(k)).map((k) => Number(k.split(".")[1]) + 1));
  const [people, setPeople] = useState(Math.min(6, initialPeople));
  const [management, setManagement] = useState(f.v("management") || "member_managed");
  const [purpose, setPurpose] = useState(f.v("purpose.type") || "general");
  const [effective, setEffective] = useState(f.v("effective.type") || "upon_filing");
  const role = management === "manager_managed" ? "manager" : "member";

  return (
    <FormFrame orderId={orderId} state={state} action={action} submitLabel="Submit LLC information">
      <Fieldset legend="LLC name" description="The Texas Secretary of State decides whether a name is available. Give us a backup in case it isn't.">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField className="sm:col-span-2" name="company.name" label="Name (without the ending)" hint="e.g. “Lone Star Bakery”" defaultValue={f.v("company.name")} error={f.e("company.name")} />
          <SelectField name="company.designator" label="Ending" options={LLC_DESIGNATORS.map((d) => ({ value: d, label: d }))} defaultValue={f.v("company.designator") || "LLC"} error={f.e("company.designator")} />
        </div>
        <TextField name="company.alternateName" label="Backup name" optional defaultValue={f.v("company.alternateName")} error={f.e("company.alternateName")} />
      </Fieldset>

      <Fieldset legend="Management">
        <div onChange={(e) => setManagement((e.target as HTMLInputElement).value)}>
          <RadioGroup
            name="management"
            legend="How will the LLC be managed?"
            defaultValue={management}
            error={f.e("management")}
            options={[
              { value: "member_managed", label: "Member-managed", description: "The owners (members) run the business directly. Most common for small LLCs." },
              { value: "manager_managed", label: "Manager-managed", description: "One or more managers run the business on the members' behalf." },
            ]}
          />
        </div>
      </Fieldset>

      <Fieldset legend={role === "member" ? "Members" : "Managers"} description={`List each ${role}. These names and addresses will appear on the public filing.`}>
        {f.e("governingPersons") ? <p className="text-sm text-danger-fg">{f.e("governingPersons")}</p> : null}
        {Array.from({ length: people }, (_, i) => (
          <div key={i} className="space-y-4 rounded-lg border border-line bg-paper p-4">
            <p className="text-sm font-medium">
              {role === "member" ? "Member" : "Manager"} {i + 1}
            </p>
            <TextField name={`governingPersons.${i}.name`} label="Full name or company name" defaultValue={f.v(`governingPersons.${i}.name`)} error={f.e(`governingPersons.${i}.name`)} />
            <AddressFields prefix={`governingPersons.${i}.address`} f={f} />
          </div>
        ))}
        <div className="flex gap-3">
          {people < 6 ? (
            <Button variant="secondary" size="sm" onClick={() => setPeople(people + 1)}>
              Add another {role}
            </Button>
          ) : null}
          {people > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setPeople(people - 1)}>
              Remove last
            </Button>
          ) : null}
        </div>
      </Fieldset>

      <Fieldset legend="Organizer" description="The person submitting the formation, usually you.">
        <TextField name="organizer.name" label="Full name" defaultValue={f.v("organizer.name")} error={f.e("organizer.name")} />
        <AddressFields prefix="organizer.address" f={f} />
      </Fieldset>

      <Fieldset legend="Business address" description="Where the LLC will operate or receive business mail.">
        <AddressFields prefix="businessAddress" f={f} />
      </Fieldset>

      <Fieldset legend="Registered agent">
        {ownAgent ? (
          <>
            <p className="text-sm text-muted">You chose to provide your own registered agent. They must have a Texas street address and agree to serve.</p>
            <TextField name="ownAgent.name" label="Registered agent's name" defaultValue={f.v("ownAgent.name")} error={f.e("ownAgent.name")} />
            <AddressFields prefix="ownAgent.address" f={f} stateHint="Must be in Texas" />
            <CheckboxField name="ownAgent.consent" defaultChecked={f.checked("ownAgent.consent")} error={f.e("ownAgent.consent")} label="This person or company has agreed to serve as the LLC's registered agent." />
          </>
        ) : (
          <Alert tone="info">We&apos;ll be your registered agent. You don&apos;t need to enter anything here.</Alert>
        )}
      </Fieldset>

      <Fieldset legend="Purpose">
        <div onChange={(e) => {
          const t = e.target as HTMLInputElement;
          if (t.name === "purpose.type") setPurpose(t.value);
        }}>
          <RadioGroup
            name="purpose.type"
            legend="What will the LLC do?"
            defaultValue={purpose}
            options={[
              { value: "general", label: "Any lawful business (general purpose)", description: "The standard choice for most LLCs." },
              { value: "specific", label: "A specific purpose" },
            ]}
          />
        </div>
        {purpose === "specific" ? <TextAreaField name="purpose.text" label="Describe the purpose" rows={3} defaultValue={f.v("purpose.text")} error={f.e("purpose.text")} /> : null}
      </Fieldset>

      <Fieldset legend="Effective date">
        <div onChange={(e) => {
          const t = e.target as HTMLInputElement;
          if (t.name === "effective.type") setEffective(t.value);
        }}>
          <RadioGroup
            name="effective.type"
            legend="When should the LLC come into existence?"
            defaultValue={effective}
            options={[
              { value: "upon_filing", label: "When the state approves the filing" },
              { value: "specific_date", label: "On a later date (up to 90 days out)" },
            ]}
          />
        </div>
        {effective === "specific_date" ? <TextField name="effective.date" label="Effective date" type="date" defaultValue={f.v("effective.date")} error={f.e("effective.date")} /> : null}
      </Fieldset>

      <ContactFields f={f} legend="Contact for this order" description="Who we should contact with questions about the filing." />

      <div className="space-y-4">
        <CheckboxField name="attestAccurate" defaultChecked={f.checked("attestAccurate")} error={f.e("attestAccurate")} label="I've reviewed this information and it is accurate and complete." />
        <CheckboxField name="attestAuthorized" defaultChecked={f.checked("attestAuthorized")} error={f.e("attestAuthorized")} label="I am authorized to form this LLC and to have this filing submitted on its behalf." />
      </div>
    </FormFrame>
  );
}

/* ------------------------------ business address ----------------------------- */

export function BusinessAddressIntakeForm({ orderId, defaults }: { orderId: string; defaults: Defaults }) {
  const [state, action] = useActionState<FormState, FormData>(submitIntakeAction.bind(null, orderId), {});
  const f = useField(state, defaults);
  return (
    <FormFrame orderId={orderId} state={state} action={action} submitLabel="Submit information">
      <Fieldset legend="Business">
        <TextField name="businessName" label="Business name" defaultValue={f.v("businessName")} error={f.e("businessName")} />
      </Fieldset>
      <ContactFields f={f} legend="Contact" description="Who we should contact about mail service setup." />
      <TextAreaField name="notes" label="Anything we should know?" optional rows={3} defaultValue={f.v("notes")} error={f.e("notes")} />
      <CheckboxField
        name="acknowledgeVerification"
        defaultChecked={f.checked("acknowledgeVerification")}
        error={f.e("acknowledgeVerification")}
        label="I understand identity verification (for example, USPS Form 1583 and two forms of ID) may be required before mail service begins."
      />
    </FormFrame>
  );
}
