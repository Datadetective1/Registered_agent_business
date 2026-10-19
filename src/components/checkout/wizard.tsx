"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { checkoutSignInAction, createCheckoutAccountAction, submitCheckoutAction, type CheckoutActionResult } from "@/app/order/actions";
import { sendFunnelEvent } from "@/components/site/track-event";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField, FieldError, SelectField, TextField } from "@/components/ui/field";
import { ChevronDownIcon, LockIcon } from "@/components/ui/icons";
import { LEGAL_DOCS, type LegalSlug } from "@/config/legal";
import { STATE_CODES, US_STATES, stateName } from "@/config/states";
import {
  CHECKOUT_STEPS,
  COUNTRIES,
  STEP_LABEL,
  emptyWizardData,
  isUsCountry,
  validateAccount,
  validateCompany,
  validateContact,
  validateFormation,
  type CheckoutProduct,
  type CheckoutStep,
  type CompanyData,
  type ContactData,
  type FormationData,
  type WizardData,
} from "@/lib/checkout";
import type { FieldErrors } from "@/lib/forms";
import { ENTITY_TYPE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { CheckoutProgress, OrderSummary, summaryTotal, type SummaryLine } from "./checkout-shell";

/*
 * Step-by-step checkout: Company → Contact → Account → Payment.
 *
 * - The current step lives in the URL (?step=), so browser back/forward and refresh work.
 * - Answers are kept in sessionStorage for this tab only (never the password), so going
 *   back and forth or refreshing doesn't lose anything. The draft is cleared after payment.
 * - The account is created at step 3 without leaving the page.
 * - Everything is validated again on the server before an order is created.
 */

export type BusinessOption = { id: string; legalName: string; stateName: string; disabled: boolean };

export type WizardProps = {
  product: CheckoutProduct;
  brand: string;
  offers: {
    ra: { available: boolean; name: string; priceCents: number; states: string[] };
    formation: { available: boolean; name: string; serviceFeeCents: number; stateFeeCents: number; stateFeeLabel: string };
    address: { available: boolean; name: string; priceCents: number; billing: "one_time" | "annual" | "monthly" };
  };
  messages: { renewal: string; changeOfAgent: string };
  payments: "stripe_test" | "stripe_live" | "simulated" | "disabled";
  account: { signedIn: boolean; email?: string };
  prefill: Partial<ContactData>;
  businesses: BusinessOption[];
  defaults: { state?: string; name?: string };
};

const PATH: Record<CheckoutProduct, string> = {
  registered_agent: "/order/registered-agent",
  llc_formation: "/order/llc-formation",
  business_address: "/order/business-address",
};
const TITLE: Record<CheckoutProduct, string> = {
  registered_agent: "Registered agent service",
  llc_formation: "Start your Texas LLC",
  business_address: "Business address",
};
const STEP_HEADING: Record<CheckoutStep, string> = {
  company: "Tell us about your company",
  contact: "Your contact details",
  account: "Create your account",
  payment: "Review and pay",
};

const ALL_STATES: string[] = [...STATE_CODES];
const ENTITY_OPTIONS = Object.entries(ENTITY_TYPE_LABEL).map(([value, label]) => ({ value, label }));
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: c }));
const US_STATE_OPTIONS = US_STATES.map((s) => ({ value: s.code, label: s.name }));

/* --------------------------------- storage -------------------------------- */

const DRAFT_KEY = "checkout:draft:v1";
const EVENTS_KEY = "checkout:events:v1";
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Draft = { savedAt: number; data: Omit<WizardData, "acceptTerms"> };

function readDraft(): Draft["data"] | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (!draft?.data || typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) return null;
    return draft.data;
  } catch {
    return null;
  }
}

function writeDraft(data: WizardData) {
  try {
    const { company, formation, contact } = data;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), data: { company, formation, contact } } satisfies Draft));
  } catch {
    // storage full or disabled: the wizard still works, it just won't survive a refresh
  }
}

/** Called on the payment success page. */
export function clearCheckoutDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(EVENTS_KEY);
  } catch {
    // ignore
  }
}

/** Copy fields from a stored section that match the expected type (drafts are untrusted input). */
function mergeSection<T extends object>(base: T, raw: unknown, keepBaseWhenEmpty = false): T {
  if (!raw || typeof raw !== "object") return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, baseValue] of Object.entries(base)) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v !== typeof baseValue) continue;
    if (keepBaseWhenEmpty && v === "" && baseValue !== "") continue;
    out[k] = typeof v === "string" ? v.slice(0, 300) : v;
  }
  return out as T;
}

function initialData(p: WizardProps): WizardData {
  const d = emptyWizardData({
    jurisdiction: p.defaults.state && (p.product !== "registered_agent" || p.offers.ra.states.includes(p.defaults.state)) ? p.defaults.state : undefined,
    llcName: p.defaults.name,
  });
  if (p.product === "registered_agent" && !p.offers.ra.states.includes(d.company.jurisdiction)) d.company.jurisdiction = p.offers.ra.states[0] ?? "";
  if (!p.offers.ra.available) d.formation.raChoice = "own";
  for (const [k, v] of Object.entries(p.prefill)) if (v) (d.contact as Record<string, string>)[k] = v;
  if (p.prefill.country && !(COUNTRIES as readonly string[]).includes(p.prefill.country)) {
    d.contact.country = "Other";
    d.contact.countryOther = p.prefill.country;
  }
  return d;
}

function applyDraft(base: WizardData, draft: Draft["data"], p: WizardProps): WizardData {
  const company = mergeSection<CompanyData>(base.company, draft.company);
  // A link from a state page (?state=) wins over an older draft the customer hasn't really started.
  if (p.defaults.state && !company.legalName && base.company.jurisdiction === p.defaults.state) company.jurisdiction = p.defaults.state;
  if (company.business !== "new" && !p.businesses.some((b) => b.id === company.business && !b.disabled)) company.business = "new";
  const formation = mergeSection<FormationData>(base.formation, draft.formation);
  if (p.defaults.name && !formation.llcName) formation.llcName = p.defaults.name;
  if (!p.offers.ra.available) formation.raChoice = "own";
  return { company, formation, contact: mergeSection<ContactData>(base.contact, draft.contact, true), acceptTerms: false };
}

function markEventSent(name: string): boolean {
  try {
    const sent = new Set<string>(JSON.parse(sessionStorage.getItem(EVENTS_KEY) ?? "[]"));
    if (sent.has(name)) return false;
    sent.add(name);
    sessionStorage.setItem(EVENTS_KEY, JSON.stringify([...sent]));
    return true;
  } catch {
    return true;
  }
}

function readAttribution(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const v = params.get(key);
    if (v) out[key] = v.slice(0, 100);
  }
  return out;
}

function parseStep(value: string | null): CheckoutStep {
  return (CHECKOUT_STEPS as readonly string[]).includes(value ?? "") ? (value as CheckoutStep) : "company";
}

const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;

/* --------------------------------- pricing -------------------------------- */

function summaryLines(p: WizardProps, data: WizardData): SummaryLine[] {
  const { ra, formation, address } = p.offers;
  const raLine: SummaryLine = { description: `${ra.name} (first year)`, amountCents: ra.priceCents, billing: "annual", kind: "service" };
  if (p.product === "registered_agent") return [raLine];
  if (p.product === "llc_formation") {
    const lines: SummaryLine[] = [{ description: `${formation.name}: service fee`, amountCents: formation.serviceFeeCents, billing: "one_time", kind: "service" }];
    if (formation.stateFeeCents > 0) lines.push({ description: formation.stateFeeLabel, amountCents: formation.stateFeeCents, billing: "one_time", kind: "government_fee" });
    if (data.formation.raChoice === "ours" && ra.available) lines.push(raLine);
    return lines;
  }
  return [{ description: `${address.name} (first ${address.billing === "monthly" ? "month" : "year"})`, amountCents: address.priceCents, billing: address.billing, kind: "service" }];
}

function summarySubject(p: WizardProps, data: WizardData): string | undefined {
  if (p.product === "llc_formation") return data.formation.llcName.trim() ? `${data.formation.llcName.trim()} · Texas` : "Your new Texas LLC";
  if (data.company.business !== "new") {
    const b = p.businesses.find((x) => x.id === data.company.business);
    return b ? `${b.legalName} · ${b.stateName}` : undefined;
  }
  const name = data.company.legalName.trim();
  return name ? `${name} · ${stateName(data.company.jurisdiction)}` : undefined;
}

function termsLinks(p: WizardProps, data: WizardData): Array<{ slug: LegalSlug; title: string }> {
  const slugs: LegalSlug[] = ["terms"];
  if (p.product === "registered_agent") slugs.push("registered-agent-terms");
  if (p.product === "llc_formation") {
    slugs.push("formation-disclaimer");
    if (data.formation.raChoice === "ours") slugs.push("registered-agent-terms");
  }
  if (p.product === "business_address") slugs.push("mail-address-terms");
  slugs.push("refund-policy");
  return slugs.map((slug) => ({ slug, title: LEGAL_DOCS.find((d) => d.slug === slug)?.title ?? slug }));
}

/* --------------------------------- wizard --------------------------------- */

export function CheckoutWizard(props: WizardProps) {
  const { product, offers, businesses } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<WizardData>(() => initialData(props));
  const [hydrated, setHydrated] = useState(false);
  const [attempted, setAttempted] = useState<Partial<Record<CheckoutStep, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [justSignedIn, setJustSignedIn] = useState(false);
  const [accountMode, setAccountMode] = useState<"create" | "sign_in">("create");
  const [emailTaken, setEmailTaken] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<"heading" | "error" | null>(null);

  const signedIn = props.account.signedIn || justSignedIn;
  const busy = isPending || redirecting;

  /* ----- validation ----- */

  function errorsFor(step: CheckoutStep, d: WizardData = data): FieldErrors {
    switch (step) {
      case "company": {
        if (product === "llc_formation") return validateFormation(d.formation);
        if (d.company.business !== "new") {
          return businesses.some((b) => b.id === d.company.business && !b.disabled) ? {} : { business: "Choose a business" };
        }
        const company = product === "business_address" && !d.company.situation ? { ...d.company, situation: "existing" as const } : d.company;
        return validateCompany(company, { availableStates: product === "registered_agent" ? offers.ra.states : ALL_STATES });
      }
      case "contact":
        return validateContact(d.contact);
      case "account":
        return signedIn ? {} : { account: "Create your account or sign in" };
      case "payment":
        return d.acceptTerms ? {} : { acceptTerms: "Please agree to the terms to continue" };
    }
  }

  /** The furthest step the customer may be on: the first incomplete step before the one requested. */
  function clamp(requested: CheckoutStep): CheckoutStep {
    for (const s of CHECKOUT_STEPS) {
      if (s === requested) return s;
      if (hasErrors(errorsFor(s))) return s;
    }
    return requested;
  }

  const requested = parseStep(searchParams.get("step"));
  const step = hydrated ? clamp(requested) : requested;
  const stepIndex = CHECKOUT_STEPS.indexOf(step);

  /* ----- effects ----- */

  // Restore this tab's draft once on mount (sessionStorage isn't available during SSR).
  useEffect(() => {
    const draft = readDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
    if (draft) setData((d) => applyDraft(d, draft, props));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) writeDraft(data);
  }, [data, hydrated]);

  // Keep the URL honest if someone lands on a step they haven't reached yet.
  useEffect(() => {
    if (hydrated && step !== requested) window.history.replaceState(null, "", urlFor(step));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, step, requested]);

  useEffect(() => {
    if (!hydrated) return;
    const name = step === "company" ? "checkout_started" : `checkout_${step}_step`;
    if (markEventSent(`${product}:${name}`)) sendFunnelEvent(name);
  }, [hydrated, step, product]);

  useEffect(() => {
    if (focusTarget.current === "heading") headingRef.current?.focus();
    if (focusTarget.current === "error") rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus();
    focusTarget.current = null;
  });

  // Coming back from the payment page with the browser's back button restores this page from cache.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setRedirecting(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  /* ----- navigation ----- */

  function urlFor(s: CheckoutStep): string {
    const url = new URL(window.location.href);
    url.pathname = PATH[product];
    if (s === "company") url.searchParams.delete("step");
    else url.searchParams.set("step", s);
    return url.pathname + url.search;
  }

  function goTo(s: CheckoutStep) {
    setServerErrors({});
    setServerMessage(null);
    window.history.pushState(null, "", urlFor(s));
    focusTarget.current = "heading";
    window.scrollTo({ top: 0 });
  }

  function nextStep(s: CheckoutStep): CheckoutStep {
    const n = CHECKOUT_STEPS[Math.min(CHECKOUT_STEPS.indexOf(s) + 1, CHECKOUT_STEPS.length - 1)];
    return n === "account" && signedIn ? "payment" : n;
  }

  function prevStep(s: CheckoutStep): CheckoutStep {
    const p = CHECKOUT_STEPS[Math.max(CHECKOUT_STEPS.indexOf(s) - 1, 0)];
    return p === "account" && signedIn ? "contact" : p;
  }

  function showErrors(s: CheckoutStep) {
    setAttempted((a) => ({ ...a, [s]: true }));
    focusTarget.current = "error";
  }

  function continueFrom(s: CheckoutStep) {
    if (hasErrors(errorsFor(s))) return showErrors(s);
    goTo(nextStep(s));
  }

  function handleFailure(res: CheckoutActionResult) {
    if (res.ok) return;
    const target = res.step ?? step;
    if (target !== step) goTo(target);
    setServerErrors(res.errors ?? {});
    setServerMessage(res.message ?? null);
    if (res.errors) showErrors(target);
  }

  /* ----- field updates ----- */

  function clearServerErrors(keys: string[]) {
    if (keys.some((k) => serverErrors[k])) setServerErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))));
  }
  function setCompany(patch: Partial<CompanyData>) {
    setData((d) => ({ ...d, company: { ...d.company, ...patch } }));
    clearServerErrors(Object.keys(patch));
  }
  function setFormation(patch: Partial<FormationData>) {
    setData((d) => ({ ...d, formation: { ...d.formation, ...patch } }));
    clearServerErrors(Object.keys(patch));
  }
  function setContact(patch: Partial<ContactData>) {
    setData((d) => ({ ...d, contact: { ...d.contact, ...patch } }));
    clearServerErrors(Object.keys(patch));
  }

  /** Move to the other product's checkout, carrying the answers over. */
  function switchProduct(to: CheckoutProduct, d: WizardData) {
    writeDraft(d);
    router.push(PATH[to]);
  }

  /* ----- server calls ----- */

  function createAccount() {
    const errs = validateAccount({ email: data.contact.email, password });
    if (hasErrors(errs)) return showErrors("account");
    startTransition(async () => {
      const res = await createCheckoutAccountAction({ email: data.contact.email, password, contact: data.contact });
      if (res.ok) return afterSignIn();
      if (!res.ok && res.code === "email_taken") {
        setEmailTaken(true);
        setAccountMode("sign_in");
        setAttempted((a) => ({ ...a, account: false }));
        return;
      }
      handleFailure(res);
    });
  }

  function signIn() {
    if (!data.contact.email.trim() || !password) return showErrors("account");
    startTransition(async () => {
      const res = await checkoutSignInAction({ email: data.contact.email, password });
      if (res.ok) return afterSignIn();
      handleFailure(res);
    });
  }

  function afterSignIn() {
    // No router.refresh(): it would re-render this page for the old ?step=account URL.
    // The session cookie is already set, and the server re-checks it on payment.
    setJustSignedIn(true);
    setPassword("");
    setEmailTaken(false);
    goTo("payment");
  }

  function pay() {
    if (hasErrors(errorsFor("payment"))) return showErrors("payment");
    startTransition(async () => {
      const res = await submitCheckoutAction({ product, data, attribution: readAttribution() });
      if (res.ok && res.url) {
        setRedirecting(true);
        window.location.assign(res.url);
        return;
      }
      handleFailure(res);
    });
  }

  /* ----- render ----- */

  const lines = summaryLines(props, data);
  const total = summaryTotal(lines);
  const subject = summarySubject(props, data);
  const live = attempted[step] ? errorsFor(step) : {};
  const accountErrors =
    step === "account" && attempted.account
      ? accountMode === "create"
        ? validateAccount({ email: data.contact.email, password })
        : { ...(data.contact.email.trim() ? {} : { email: "Enter your email address" }), ...(password ? {} : { password: "Enter your password" }) }
      : {};
  const errors: FieldErrors = { ...live, ...accountErrors, ...serverErrors };
  const summaryNote =
    product === "registered_agent" ? "No setup fee. No monthly fee." : product === "llc_formation" ? "We're a filing service, not a law firm. We don't give legal or tax advice." : undefined;

  const ready = hydrated || step === "company";

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <CheckoutProgress current={stepIndex} labels={CHECKOUT_STEPS.map((s) => STEP_LABEL[s])} onSelect={(i) => goTo(CHECKOUT_STEPS[i])} />
      <h1 className="mt-5 text-2xl font-semibold sm:mt-6 sm:text-3xl">{TITLE[product]}</h1>

      {step !== "payment" ? (
        <details className="group mt-4 rounded-xl border border-line bg-surface lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-medium">Order summary</span>
            <span className="flex items-center gap-2 font-semibold tabular-nums">
              {formatMoney(total)}
              <ChevronDownIcon size={18} className="transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <OrderSummary lines={lines} subject={subject} heading={null} footnote={summaryNote} className="rounded-t-none border-x-0 border-b-0" />
        </details>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section aria-labelledby="checkout-step-heading" className="min-w-0 rounded-xl border border-line bg-surface p-5 sm:p-7">
          <h2 id="checkout-step-heading" ref={headingRef} tabIndex={-1} className="font-sans text-lg font-semibold outline-none sm:text-xl">
            {STEP_HEADING[step === "account" && signedIn ? "account" : step]}
          </h2>
          {serverMessage ? (
            <Alert tone="danger" role="alert" className="mt-4">
              {serverMessage}
            </Alert>
          ) : null}

          {!ready ? (
            <p className="mt-6 text-sm text-muted" role="status">
              Loading your details…
            </p>
          ) : step === "company" ? (
            <CompanyStep
              {...props}
              data={data}
              errors={errors}
              setCompany={setCompany}
              setFormation={setFormation}
              onContinue={() => continueFrom("company")}
              onSwitch={(to) =>
                switchProduct(
                  to,
                  to === "llc_formation"
                    ? { ...data, formation: { llcName: data.formation.llcName || data.company.legalName, raChoice: offers.ra.available ? "ours" : "own" } }
                    : { ...data, company: { ...data.company, business: "new", situation: "existing" } },
                )
              }
            />
          ) : step === "contact" ? (
            <ContactStep data={data.contact} errors={errors} setContact={setContact} onBack={() => goTo(prevStep("contact"))} onContinue={() => continueFrom("contact")} />
          ) : step === "account" ? (
            signedIn ? (
              <div className="mt-5 space-y-5">
                <p className="text-[15px]">
                  You&apos;re signed in{props.account.email ? ` as ${props.account.email}` : ""}. This order will be added to your account.
                </p>
                <StepButtons onBack={() => goTo("contact")} onContinue={() => goTo("payment")} />
              </div>
            ) : (
              <AccountStep
                mode={accountMode}
                setMode={(m) => {
                  setAccountMode(m);
                  setEmailTaken(false);
                  setServerErrors({});
                  setServerMessage(null);
                }}
                email={data.contact.email}
                setEmail={(email) => setContact({ email })}
                password={password}
                setPassword={(v) => {
                  setPassword(v);
                  clearServerErrors(["password"]);
                }}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                emailTaken={emailTaken}
                errors={errors}
                busy={busy}
                onBack={() => goTo("contact")}
                onSubmit={accountMode === "create" ? createAccount : signIn}
              />
            )
          ) : (
            <PaymentStep
              {...props}
              data={data}
              errors={errors}
              lines={lines}
              total={total}
              subject={subject}
              summaryNote={summaryNote}
              signedInEmail={props.account.email ?? data.contact.email}
              setAcceptTerms={(acceptTerms) => {
                setData((d) => ({ ...d, acceptTerms }));
                clearServerErrors(["acceptTerms"]);
              }}
              onEdit={goTo}
              busy={busy}
              onBack={() => goTo(prevStep("payment"))}
              onPay={pay}
            />
          )}
        </section>

        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <OrderSummary lines={lines} subject={subject} footnote={summaryNote} />
        </aside>
      </div>
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function StepButtons({
  onBack,
  onContinue,
  continueLabel = "Continue",
  busy,
  busyLabel,
  type = "button",
}: {
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: ReactNode;
  busy?: boolean;
  busyLabel?: string;
  type?: "button" | "submit";
}) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button variant="ghost" size="lg" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
          Back
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <Button
        type={type}
        size="lg"
        onClick={type === "button" ? onContinue : undefined}
        disabled={busy}
        aria-disabled={busy || undefined}
        className="w-full sm:w-auto sm:min-w-44"
      >
        {busy && busyLabel ? busyLabel : continueLabel}
      </Button>
    </div>
  );
}

function ChoiceCards<T extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  error,
  columns = 1,
}: {
  name: string;
  legend: ReactNode;
  value: T | "";
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: ReactNode; description?: ReactNode }>;
  error?: string;
  columns?: 1 | 2;
}) {
  const id = `f-${name}`;
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      <div className={columns === 2 ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}>
        {options.map((o, i) => (
          <label
            key={o.value}
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-line-strong bg-surface px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-info-bg/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30"
          >
            <input
              type="radio"
              id={i === 0 ? id : undefined}
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              data-invalid={error ? "true" : undefined}
              className="mt-1 size-4 shrink-0 accent-[var(--brand-primary)]"
            />
            <span className="text-[15px] leading-snug">
              <span className="font-medium text-ink">{o.label}</span>
              {o.description ? <span className="mt-0.5 block text-sm text-muted">{o.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}

/* ------------------------------ step 1: company ----------------------------- */

function CompanyStep(
  p: WizardProps & {
    data: WizardData;
    errors: FieldErrors;
    setCompany: (patch: Partial<CompanyData>) => void;
    setFormation: (patch: Partial<FormationData>) => void;
    onContinue: () => void;
    onSwitch: (to: CheckoutProduct) => void;
  },
) {
  const { product, data, errors, offers } = p;
  const c = data.company;

  if (product === "llc_formation") {
    const f = data.formation;
    return (
      <form
        noValidate
        className="mt-5 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          p.onContinue();
        }}
      >
        <TextField
          name="llcName"
          label="LLC name you'd like"
          autoComplete="organization"
          value={f.llcName}
          onChange={(e) => p.setFormation({ llcName: e.target.value })}
          error={errors.llcName}
          hint="Just the name for now. After checkout you'll choose the ending (LLC, L.L.C., …) and a backup name. The Texas Secretary of State makes the final call on availability."
        />
        <div className="rounded-md border border-line bg-paper px-4 py-3 text-[15px]">
          <span className="text-muted">State of formation:</span> <span className="font-medium">Texas</span>
        </div>
        <ChoiceCards<"ours" | "own">
          name="raChoice"
          legend="Registered agent"
          value={f.raChoice}
          onChange={(raChoice) => p.setFormation({ raChoice })}
          error={errors.raChoice}
          options={[
            ...(offers.ra.available
              ? [
                  {
                    value: "ours" as const,
                    label: `Add registered agent service: ${formatMoney(offers.ra.priceCents)}/year (recommended)`,
                    description: "Every Texas LLC must name a registered agent with a Texas street address. We'll be yours from day one.",
                  },
                ]
              : []),
            {
              value: "own" as const,
              label: "I'll name my own registered agent",
              description: "You'll give us their name and Texas street address after checkout and confirm they've agreed to serve.",
            },
          ]}
        />
        {offers.ra.available ? (
          <p className="text-sm text-muted">
            Already have a business?{" "}
            <button type="button" className="font-medium text-brand underline underline-offset-2" onClick={() => p.onSwitch("registered_agent")}>
              Get registered agent service only
            </button>
          </p>
        ) : null}
        <StepButtons type="submit" />
      </form>
    );
  }

  const selectable = p.businesses.filter((b) => !b.disabled);
  const isNew = c.business === "new";
  const forming = c.situation === "forming";
  const stateOptions = (product === "registered_agent" ? offers.ra.states : ALL_STATES).map((code) => ({ value: code, label: stateName(code) }));
  const offerFormation = product === "registered_agent" && forming && c.jurisdiction === "TX" && c.entityType === "llc" && offers.formation.available;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      noValidate
      className="mt-5 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        p.onContinue();
      }}
    >
      {selectable.length ? (
        <ChoiceCards
          name="business"
          legend="Which business is this for?"
          value={c.business}
          onChange={(business) => p.setCompany({ business })}
          error={errors.business}
          options={[...selectable.map((b) => ({ value: b.id, label: b.legalName, description: b.stateName })), { value: "new", label: "A different business" }]}
        />
      ) : null}

      {isNew ? (
        <>
          {product === "registered_agent" ? (
            <ChoiceCards<"existing" | "forming">
              name="situation"
              legend="Which describes you?"
              value={c.situation}
              onChange={(situation) => p.setCompany({ situation })}
              error={errors.situation}
              columns={2}
              options={[
                { value: "existing", label: "I already have a business", description: "It's registered with the state." },
                { value: "forming", label: "I'm forming a new business", description: "I haven't filed formation documents yet." },
              ]}
            />
          ) : null}

          {c.situation || product !== "registered_agent" ? (
            <div className="space-y-5">
              {offerFormation ? (
                <div className="rounded-lg border border-brand/25 bg-info-bg/50 p-4 sm:p-5">
                  <p className="font-semibold text-ink">Form your Texas LLC and get registered agent service in one order</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {formatMoney(offers.formation.serviceFeeCents)} service fee + {formatMoney(offers.formation.stateFeeCents)} Texas filing fee
                    (a government fee), plus {formatMoney(offers.ra.priceCents)}/year for registered agent service.
                  </p>
                  <Button className="mt-3 w-full sm:w-auto" onClick={() => p.onSwitch("llc_formation")}>
                    Form my LLC with {p.brand}
                  </Button>
                  <p className="mt-3 text-sm text-muted">Filing it yourself? Fill in the details below and list us as your registered agent when you file.</p>
                </div>
              ) : null}

              <TextField
                name="legalName"
                label={forming ? "Company name you plan to use" : "Legal company name"}
                autoComplete="organization"
                value={c.legalName}
                onChange={(e) => p.setCompany({ legalName: e.target.value })}
                error={errors.legalName}
                hint={forming ? undefined : "As registered with the state, e.g. “Lone Star Widgets LLC”."}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  name="entityType"
                  label="Entity type"
                  options={ENTITY_OPTIONS}
                  value={c.entityType}
                  onChange={(e) => p.setCompany({ entityType: e.target.value })}
                  error={errors.entityType}
                />
                <SelectField
                  name="jurisdiction"
                  label={forming ? "State of formation" : "State where it's registered"}
                  options={stateOptions}
                  placeholder={stateOptions.some((o) => o.value === c.jurisdiction) ? undefined : "Choose a state"}
                  value={c.jurisdiction}
                  onChange={(e) => p.setCompany({ jurisdiction: e.target.value })}
                  error={errors.jurisdiction}
                />
              </div>

              {c.situation === "existing" && product === "registered_agent" ? (
                <div className="space-y-3">
                  <TextField
                    name="formationDate"
                    label="Formation date"
                    optional
                    type="date"
                    max={today}
                    value={c.formationDateUnknown ? "" : c.formationDate}
                    disabled={c.formationDateUnknown}
                    onChange={(e) => p.setCompany({ formationDate: e.target.value })}
                    error={errors.formationDate}
                    className="sm:max-w-xs"
                  />
                  <CheckboxField
                    name="formationDateUnknown"
                    label="I don't know my formation date"
                    checked={c.formationDateUnknown}
                    onChange={(e) => p.setCompany({ formationDateUnknown: e.target.checked, ...(e.target.checked ? { formationDate: "" } : {}) })}
                  />
                </div>
              ) : null}

              {product === "registered_agent" && c.situation === "existing" ? (
                <Alert tone="info">{p.messages.changeOfAgent}</Alert>
              ) : null}
              {product === "registered_agent" && forming && !offerFormation ? (
                <Alert tone="info">
                  List us as your registered agent when you file your formation documents. We&apos;ll confirm the exact registered agent name and
                  address to use after checkout.
                </Alert>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <StepButtons type="submit" />
    </form>
  );
}

/* ------------------------------ step 2: contact ----------------------------- */

function ContactStep({
  data: c,
  errors,
  setContact,
  onBack,
  onContinue,
}: {
  data: ContactData;
  errors: FieldErrors;
  setContact: (patch: Partial<ContactData>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const us = isUsCountry(c.country);
  return (
    <form
      noValidate
      className="mt-5 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
    >
      <p className="text-sm text-muted">We&apos;ll use these to send order updates and contact you about your order. Your business&apos;s addresses come later.</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label="First name" autoComplete="given-name" value={c.firstName} onChange={(e) => setContact({ firstName: e.target.value })} error={errors.firstName} />
        <TextField name="lastName" label="Last name" autoComplete="family-name" value={c.lastName} onChange={(e) => setContact({ lastName: e.target.value })} error={errors.lastName} />
      </div>
      <TextField
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={c.email}
        onChange={(e) => setContact({ email: e.target.value })}
        error={errors.email}
      />
      <TextField
        name="phone"
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={c.phone}
        onChange={(e) => setContact({ phone: e.target.value })}
        error={errors.phone}
        hint="Only used for questions about your order."
      />
      <SelectField
        name="country"
        label="Country"
        autoComplete="country-name"
        options={COUNTRY_OPTIONS}
        value={c.country}
        onChange={(e) => {
          const us = isUsCountry(e.target.value);
          // Don't carry a US state into a foreign address (or free text into the US state list).
          const clearState = us ? !STATE_CODES.includes(c.state) : STATE_CODES.includes(c.state);
          setContact({ country: e.target.value, ...(clearState ? { state: "" } : {}) });
        }}
        error={errors.country}
      />
      {c.country === "Other" ? (
        <TextField name="countryOther" label="Country name" autoComplete="country-name" value={c.countryOther} onChange={(e) => setContact({ countryOther: e.target.value })} error={errors.countryOther} />
      ) : null}
      <TextField name="line1" label="Street address" autoComplete="address-line1" value={c.line1} onChange={(e) => setContact({ line1: e.target.value })} error={errors.line1} />
      <TextField name="line2" label="Apartment, suite, etc." optional autoComplete="address-line2" value={c.line2} onChange={(e) => setContact({ line2: e.target.value })} error={errors.line2} />
      <TextField name="city" label="City" autoComplete="address-level2" value={c.city} onChange={(e) => setContact({ city: e.target.value })} error={errors.city} />
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        {us ? (
          <SelectField
            name="state"
            label="State"
            autoComplete="address-level1"
            options={US_STATE_OPTIONS}
            placeholder="Choose…"
            value={c.state}
            onChange={(e) => setContact({ state: e.target.value })}
            error={errors.state}
          />
        ) : (
          <TextField name="state" label="State / province" optional autoComplete="address-level1" value={c.state} onChange={(e) => setContact({ state: e.target.value })} error={errors.state} />
        )}
        <TextField
          name="postalCode"
          label={us ? "ZIP code" : "Postal code"}
          optional={!us}
          autoComplete="postal-code"
          inputMode={us ? "numeric" : "text"}
          value={c.postalCode}
          onChange={(e) => setContact({ postalCode: e.target.value })}
          error={errors.postalCode}
        />
      </div>
      <StepButtons type="submit" onBack={onBack} />
    </form>
  );
}

/* ------------------------------ step 3: account ----------------------------- */

function AccountStep(p: {
  mode: "create" | "sign_in";
  setMode: (m: "create" | "sign_in") => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  emailTaken: boolean;
  errors: FieldErrors;
  busy: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const creating = p.mode === "create";
  return (
    <form
      noValidate
      className="mt-5 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        p.onSubmit();
      }}
    >
      {creating ? (
        <p className="text-sm text-muted">You&apos;ll use your account to track this order, answer a few questions after payment, and get your documents.</p>
      ) : p.emailTaken ? (
        <Alert tone="info" role="status">
          There&apos;s already an account for this email. Sign in to continue. Your checkout details are saved.
        </Alert>
      ) : (
        <p className="text-sm text-muted">Sign in to add this order to your existing account.</p>
      )}
      <TextField
        name="accountEmail"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={p.email}
        onChange={(e) => p.setEmail(e.target.value)}
        error={p.errors.email}
      />
      <div>
        <TextField
          name="password"
          label="Password"
          type={p.showPassword ? "text" : "password"}
          autoComplete={creating ? "new-password" : "current-password"}
          value={p.password}
          onChange={(e) => p.setPassword(e.target.value)}
          error={p.errors.password}
          hint={creating ? "At least 10 characters." : undefined}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={p.showPassword} onChange={(e) => p.setShowPassword(e.target.checked)} className="size-4 accent-[var(--brand-primary)]" />
            Show password
          </label>
          {!creating ? (
            <Link href="/forgot-password" target="_blank" className="text-sm text-brand underline underline-offset-2">
              Forgot your password?
            </Link>
          ) : null}
        </div>
      </div>
      <StepButtons
        type="submit"
        onBack={p.onBack}
        busy={p.busy}
        continueLabel={creating ? "Create account and continue" : "Sign in and continue"}
        busyLabel={creating ? "Creating your account…" : "Signing in…"}
      />
      <p className="border-t border-line pt-4 text-sm text-muted">
        {creating ? "Already have an account? " : "New here? "}
        <button type="button" className="font-medium text-brand underline underline-offset-2" onClick={() => p.setMode(creating ? "sign_in" : "create")}>
          {creating ? "Sign in instead" : "Create an account"}
        </button>
      </p>
    </form>
  );
}

/* ------------------------------ step 4: payment ----------------------------- */

function PaymentStep(
  p: WizardProps & {
    data: WizardData;
    errors: FieldErrors;
    lines: SummaryLine[];
    total: number;
    subject?: string;
    summaryNote?: string;
    signedInEmail: string;
    setAcceptTerms: (v: boolean) => void;
    onEdit: (s: CheckoutStep) => void;
    busy: boolean;
    onBack: () => void;
    onPay: () => void;
  },
) {
  const { data, product } = p;
  const c = data.contact;
  const company = data.company;
  const existing = company.business !== "new" ? p.businesses.find((b) => b.id === company.business) : undefined;
  const links = termsLinks(p, data);
  const disabled = p.payments === "disabled";

  const entityLabel = ENTITY_TYPE_LABEL[company.entityType as keyof typeof ENTITY_TYPE_LABEL] ?? company.entityType;
  const companyLines: string[] =
    product === "llc_formation"
      ? [
          data.formation.llcName.trim(),
          "Texas limited liability company",
          data.formation.raChoice === "ours" ? `Registered agent: ${p.brand} (included in this order)` : "Registered agent: I'll name my own",
        ]
      : existing
        ? [existing.legalName, existing.stateName]
        : [
            company.legalName.trim(),
            `${entityLabel} · ${stateName(company.jurisdiction)}`,
            product === "registered_agent"
              ? company.situation === "forming"
                ? "Forming a new business"
                : `Existing business · ${company.formationDateUnknown || !company.formationDate ? "formation date not provided" : `formed ${company.formationDate}`}`
              : "",
          ];
  const cityLine = [c.city, c.state].map((x) => x.trim()).filter(Boolean).join(", ") + (c.postalCode.trim() ? ` ${c.postalCode.trim()}` : "");
  const contactLines = [
    `${c.firstName} ${c.lastName}`.trim(),
    c.email.trim(),
    c.phone.trim(),
    [c.line1, c.line2, cityLine, c.country === "Other" ? c.countryOther : c.country].map((x) => x.trim()).filter(Boolean).join(", "),
  ];

  return (
    <form
      noValidate
      className="mt-5 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        p.onPay();
      }}
    >
      <div className="divide-y divide-line rounded-lg border border-line">
        <ReviewBlock title={product === "llc_formation" ? "Your LLC" : "Company"} onEdit={() => p.onEdit("company")} lines={companyLines} />
        <ReviewBlock title="Contact" onEdit={() => p.onEdit("contact")} lines={contactLines} />
        <ReviewBlock title="Account" lines={[`Signed in as ${p.signedInEmail}`]} />
      </div>

      <OrderSummary lines={p.lines} subject={p.subject} heading="Your order" footnote={p.summaryNote} className="bg-paper lg:hidden" />

      <CheckboxField
        name="acceptTerms"
        checked={data.acceptTerms}
        onChange={(e) => p.setAcceptTerms(e.target.checked)}
        error={p.errors.acceptTerms}
        label={
          <>
            I agree to the{" "}
            {links.map((l, i) => (
              <span key={l.slug}>
                {i > 0 ? (i === links.length - 1 ? ", and " : ", ") : null}
                <Link href={`/legal/${l.slug}`} target="_blank" className="text-brand underline underline-offset-2">
                  {l.title}
                </Link>
              </span>
            ))}
            .
          </>
        }
      />

      {p.payments === "stripe_test" ? (
        <Alert tone="warning" title="Test mode">
          No real payment is taken. On the payment page, use card 4242 4242 4242 4242 with any future date and any CVC.
        </Alert>
      ) : p.payments === "simulated" ? (
        <Alert tone="warning" title="Development mode">
          Payments are simulated. No card is needed and no money moves.
        </Alert>
      ) : disabled ? (
        <Alert tone="danger" title="Online payment is temporarily unavailable">
          Please contact us to place your order.
        </Alert>
      ) : null}

      <div className="space-y-3">
        <StepButtons
          type="submit"
          onBack={p.onBack}
          busy={p.busy || disabled}
          busyLabel={disabled ? "Payment unavailable" : "Opening secure payment…"}
          continueLabel={
            <>
              <LockIcon size={18} /> Pay {formatMoney(p.total)} securely
            </>
          }
        />
        <p className="text-sm text-muted sm:text-right">You&apos;ll enter your card on Stripe&apos;s secure payment page. We never see or store your card number.</p>
      </div>

      <div className="rounded-lg border border-line bg-paper p-4 text-sm">
        <p className="font-medium">What happens next</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>You pay securely and get an email confirmation.</li>
          <li>You answer a few questions about your business (about 5 minutes).</li>
          <li>We {product === "llc_formation" ? "prepare and file your Certificate of Formation" : "set up your service"} and keep your order updated in your account.</li>
        </ol>
      </div>
    </form>
  );
}

function ReviewBlock({ title, lines, onEdit }: { title: string; lines: string[]; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <h3 className="font-sans text-sm font-semibold text-muted">{title}</h3>
        <div className="mt-1 space-y-0.5 text-[15px] leading-snug">
          {lines.filter(Boolean).map((line, i) => (
            <p key={i} className={i === 0 ? "break-words font-medium text-ink" : "break-words text-muted"}>
              {line}
            </p>
          ))}
        </div>
      </div>
      {onEdit ? (
        <button type="button" onClick={onEdit} className="-mr-2 min-h-11 shrink-0 rounded px-2 text-sm font-medium text-brand underline underline-offset-2">
          Edit<span className="sr-only"> {title.toLowerCase()}</span>
        </button>
      ) : null}
    </div>
  );
}
