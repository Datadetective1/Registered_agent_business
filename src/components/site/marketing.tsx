import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow, Section } from "@/components/ui/layout";
import { CheckIcon, ChevronDownIcon, InfoIcon } from "@/components/ui/icons";
import type { Faq } from "@/content/faq";
import { cn } from "@/lib/utils";

export function Hero({
  eyebrow,
  title,
  lead,
  actions,
  aside,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-surface">
      <Container className={cn("grid gap-10 py-14 sm:py-20", aside ? "lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16" : null)}>
        <div>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 className="mt-3 text-[2.15rem] font-semibold leading-[1.12] sm:text-5xl">{title}</h1>
          <div className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{lead}</div>
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </Container>
    </div>
  );
}

export function PriceCard({
  name,
  price,
  period,
  breakdown,
  features,
  cta,
  footnote,
  id,
}: {
  name: string;
  price: string;
  period?: string;
  breakdown?: Array<[string, string]>;
  features?: string[];
  cta?: ReactNode;
  footnote?: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-xl border border-line bg-paper p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-7">
      <p className="text-sm font-semibold text-ink">{name}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-serif text-4xl font-semibold text-ink">{price}</span>
        {period ? <span className="text-muted">{period}</span> : null}
      </p>
      {breakdown?.length ? (
        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          {breakdown.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {features?.length ? <FeatureList items={features} className="mt-5 border-t border-line pt-5" /> : null}
      {cta ? <div className="mt-6">{cta}</div> : null}
      {footnote ? <p className="mt-4 text-xs leading-relaxed text-muted">{footnote}</p> : null}
    </div>
  );
}

export function FeatureList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((f) => (
        <li key={f} className="flex gap-2.5 text-[15px] leading-snug text-ink">
          <CheckIcon size={18} className="mt-0.5 shrink-0 text-accent" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

export function SectionHeading({ eyebrow, title, lead, center }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-[2.1rem]">{title}</h2>
      {lead ? <p className="mt-3 text-[17px] leading-relaxed text-muted">{lead}</p> : null}
    </div>
  );
}

export function Steps({ steps }: { steps: Array<{ title: string; body: ReactNode }> }) {
  return (
    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="rounded-lg border border-line bg-surface p-5">
          <span className="inline-flex size-8 items-center justify-center rounded-full border border-line-strong font-serif text-sm font-semibold text-brand">
            {i + 1}
          </span>
          <h3 className="mt-4 font-sans text-base font-semibold">{s.title}</h3>
          <div className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.body}</div>
        </li>
      ))}
    </ol>
  );
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-surface">
      {faqs.map((f) => (
        <details key={f.q} className="group px-5 py-1">
          <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left text-[16px] font-medium text-ink">
            <span>{f.q}</span>
            <ChevronDownIcon size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <p className="pb-5 pr-8 text-[15px] leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex gap-3 rounded-lg border border-warning-fg/25 bg-warning-bg px-5 py-4">
      <InfoIcon size={20} className="mt-0.5 shrink-0 text-warning-fg" />
      <div className="text-[15px] leading-relaxed text-ink">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-ink/85">{children}</div>
      </div>
    </aside>
  );
}

export function CtaBand({ title, body, primary, secondary }: { title: string; body: ReactNode; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <Section className="bg-brand text-white">
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-[17px] leading-relaxed text-white/80">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={primary.href} size="lg" variant="secondary" className="border-white bg-white text-brand hover:bg-white/90">
            {primary.label}
          </ButtonLink>
          {secondary ? (
            <ButtonLink href={secondary.href} size="lg" variant="ghost" className="text-white hover:bg-white/10">
              {secondary.label}
            </ButtonLink>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}

export function TrustPoints({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <CheckIcon size={16} className="text-accent" />
          {t}
        </li>
      ))}
    </ul>
  );
}
