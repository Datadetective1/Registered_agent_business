"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { startBusinessAddressCheckout, startFormationCheckout, startRegisteredAgentCheckout } from "@/app/order/actions";
import { Alert } from "@/components/ui/alert";
import { CheckboxField, RadioGroup, SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/forms";
import { ENTITY_TYPE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { OrderSummary, type SummaryLine } from "./checkout-shell";

type EntityOption = { id: string; legalName: string; stateName: string; disabled: boolean };
type StateOption = { code: string; name: string };

const ENTITY_TYPE_OPTIONS = Object.entries(ENTITY_TYPE_LABEL).map(([value, label]) => ({ value, label }));

function TermsCheckbox({ error, defaultChecked, links }: { error?: string; defaultChecked?: boolean; links: Array<{ href: string; label: string }> }) {
  return (
    <CheckboxField
      name="acceptTerms"
      defaultChecked={defaultChecked}
      error={error}
      label={
        <>
          I agree to the{" "}
          {links.map((l, i) => (
            <span key={l.href}>
              {i > 0 ? (i === links.length - 1 ? ", and " : ", ") : null}
              <Link href={l.href} target="_blank" className="text-brand underline underline-offset-2">
                {l.label}
              </Link>
            </span>
          ))}
          .
        </>
      }
    />
  );
}

function UtmFields() {
  // Pass campaign attribution (if any) with the order; no cookies involved. Filled after
  // mount so server and client render identical markup.
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ref.current?.querySelectorAll("input").forEach((input) => {
      input.value = params.get(input.name)?.slice(0, 100) ?? "";
    });
  }, []);
  return (
    <span ref={ref} hidden>
      {["utm_source", "utm_medium", "utm_campaign"].map((k) => (
        <input key={k} type="hidden" name={k} defaultValue="" />
      ))}
    </span>
  );
}

function BusinessPicker({
  entities,
  states,
  defaultState,
  values,
  errors,
  serviceLabel,
}: {
  entities: EntityOption[];
  states: StateOption[];
  defaultState?: string;
  values: Record<string, string>;
  errors: Record<string, string>;
  serviceLabel: string;
}) {
  const selectable = entities.filter((e) => !e.disabled);
  const [choice, setChoice] = useState(values.business ?? (selectable[0]?.id ?? "new"));
  return (
    <div className="space-y-5">
      {entities.length ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Which business is this for?</legend>
          <div className="space-y-2">
            {entities.map((e) => (
              <label
                key={e.id}
                className={`flex items-start gap-3 rounded-md border px-4 py-3 ${e.disabled ? "cursor-not-allowed border-line bg-sand text-muted" : "cursor-pointer border-line-strong bg-surface has-[:checked]:border-brand"}`}
              >
                <input type="radio" name="business" value={e.id} disabled={e.disabled} checked={choice === e.id} onChange={() => setChoice(e.id)} className="mt-1 size-4 accent-[var(--brand-primary)]" />
                <span>
                  <span className="font-medium">{e.legalName}</span>
                  <span className="block text-sm text-muted">
                    {e.stateName}
                    {e.disabled ? ` · already has ${serviceLabel}` : ""}
                  </span>
                </span>
              </label>
            ))}
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line-strong bg-surface px-4 py-3 has-[:checked]:border-brand">
              <input type="radio" name="business" value="new" checked={choice === "new"} onChange={() => setChoice("new")} className="mt-1 size-4 accent-[var(--brand-primary)]" />
              <span className="font-medium">A different business</span>
            </label>
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="business" value="new" />
      )}
      {choice === "new" ? (
        <div className="space-y-5 rounded-lg border border-line bg-paper p-5">
          <TextField name="entity.legalName" label="Legal business name" hint="Exactly as registered with the state, e.g. “Lone Star Widgets LLC”." required defaultValue={values["entity.legalName"]} error={errors["entity.legalName"]} />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField name="entity.entityType" label="Entity type" placeholder="Choose…" options={ENTITY_TYPE_OPTIONS} defaultValue={values["entity.entityType"] ?? "llc"} error={errors["entity.entityType"]} />
            <SelectField
              name="entity.jurisdiction"
              label="State of registration"
              options={states.map((s) => ({ value: s.code, label: s.name }))}
              defaultValue={values["entity.jurisdiction"] ?? defaultState ?? states[0]?.code}
              error={errors["entity.jurisdiction"]}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RegisteredAgentCheckoutForm(props: { entities: EntityOption[]; states: StateOption[]; defaultState?: string }) {
  const [state, action] = useActionState<FormState, FormData>(startRegisteredAgentCheckout, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-6 rounded-xl border border-line bg-surface p-5 sm:p-6" noValidate>
      {state.message ? <Alert tone="danger" role="alert">{state.message}</Alert> : null}
      <BusinessPicker {...props} values={v} errors={e} serviceLabel="registered agent service" />
      <p className="text-sm text-muted">
        You&apos;ll confirm addresses and contact details after payment. Our registered agent address is for service of process and
        state correspondence only. It isn&apos;t a general mailing address.
      </p>
      <TermsCheckbox
        error={e.acceptTerms}
        defaultChecked={v.acceptTerms === "on"}
        links={[
          { href: "/legal/terms", label: "Terms of Service" },
          { href: "/legal/registered-agent-terms", label: "Registered Agent Service Terms" },
          { href: "/legal/refund-policy", label: "Refund Policy" },
        ]}
      />
      <UtmFields />
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Starting secure checkout…">
        Continue to payment
      </SubmitButton>
    </form>
  );
}

export function BusinessAddressCheckoutForm(props: { entities: EntityOption[]; states: StateOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(startBusinessAddressCheckout, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-6 rounded-xl border border-line bg-surface p-5 sm:p-6" noValidate>
      {state.message ? <Alert tone="danger" role="alert">{state.message}</Alert> : null}
      <BusinessPicker {...props} values={v} errors={e} serviceLabel="a business address" />
      <TermsCheckbox
        error={e.acceptTerms}
        defaultChecked={v.acceptTerms === "on"}
        links={[
          { href: "/legal/terms", label: "Terms of Service" },
          { href: "/legal/mail-address-terms", label: "Business Address & Mail Service Terms" },
          { href: "/legal/refund-policy", label: "Refund Policy" },
        ]}
      />
      <UtmFields />
      <SubmitButton size="lg" pendingLabel="Starting secure checkout…">
        Continue to payment
      </SubmitButton>
    </form>
  );
}

export function FormationCheckout({
  formation,
  stateFee,
  ra,
}: {
  formation: { description: string; amountCents: number };
  stateFee: { description: string; amountCents: number };
  ra: { description: string; amountCents: number; available: boolean };
}) {
  const [state, action] = useActionState<FormState, FormData>(startFormationCheckout, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const [raChoice, setRaChoice] = useState<string>(v.raChoice ?? (ra.available ? "ours" : "own"));
  const lines: SummaryLine[] = [
    { description: formation.description, amountCents: formation.amountCents, billing: "one_time" },
    ...(stateFee.amountCents ? [{ description: stateFee.description, amountCents: stateFee.amountCents, billing: "one_time" as const, kind: "government_fee" as const }] : []),
    ...(raChoice === "ours" ? [{ description: `${ra.description} (first year)`, amountCents: ra.amountCents, billing: "annual" as const }] : []),
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      <form action={action} className="min-w-0 space-y-6 rounded-xl border border-line bg-surface p-5 sm:p-6" noValidate>
        {state.message ? <Alert tone="danger" role="alert">{state.message}</Alert> : null}
        <TextField name="llcName" label="Desired LLC name" hint="You can refine the name and choose its ending (LLC, L.L.C., …) after checkout." required defaultValue={v.llcName} error={e.llcName} />
        <div onChange={(ev) => setRaChoice((ev.target as HTMLInputElement).value)}>
          <RadioGroup
            name="raChoice"
            legend="Registered agent"
            defaultValue={raChoice}
            error={e.raChoice}
            options={[
              ...(ra.available
                ? [{ value: "ours", label: `Use our registered agent service: ${formatMoney(ra.amountCents)}/year`, description: "Recommended. Every Texas LLC must name a registered agent with a Texas street address." }]
                : []),
              { value: "own", label: "I'll provide my own registered agent", description: "You'll enter their name and Texas street address after checkout, and confirm they've agreed to serve." },
            ]}
          />
        </div>
        <TermsCheckbox
          error={e.acceptTerms}
          defaultChecked={v.acceptTerms === "on"}
          links={[
            { href: "/legal/terms", label: "Terms of Service" },
            { href: "/legal/formation-disclaimer", label: "Business Formation Disclaimer" },
            ...(raChoice === "ours" ? [{ href: "/legal/registered-agent-terms", label: "Registered Agent Service Terms" }] : []),
            { href: "/legal/refund-policy", label: "Refund Policy" },
          ]}
        />
        <UtmFields />
        <SubmitButton size="lg" pendingLabel="Starting secure checkout…">
          Continue to payment
        </SubmitButton>
      </form>
      <aside className="lg:sticky lg:top-6">
        <OrderSummary lines={lines} footnote="We're a filing service, not a law firm. We don't provide legal or tax advice." />
      </aside>
    </div>
  );
}
