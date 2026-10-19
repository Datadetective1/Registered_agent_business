import type { ReactNode } from "react";
import { Container } from "@/components/ui/layout";
import { CheckIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const STEPS = ["Account", "Details", "Payment", "Business information"];

export function CheckoutSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm" aria-label="Checkout progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
              i < current && "border-accent bg-accent text-white",
              i === current && "border-brand text-brand",
              i > current && "border-line-strong text-subtle",
            )}
            aria-current={i === current ? "step" : undefined}
          >
            {i < current ? <CheckIcon size={14} /> : i + 1}
          </span>
          <span className={cn(i === current ? "font-medium text-ink" : "text-muted")}>{label}</span>
          {i < STEPS.length - 1 ? <span className="mx-1 hidden h-px w-6 bg-line-strong sm:block" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

export function CheckoutShell({
  title,
  step,
  summary,
  children,
}: {
  title: string;
  step: number;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <Container className="py-8 sm:py-12">
      <CheckoutSteps current={step} />
      <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">{title}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="min-w-0">{children}</div>
        <aside className="lg:sticky lg:top-6">{summary}</aside>
      </div>
    </Container>
  );
}

export type SummaryLine = { description: string; amountCents: number; billing: "one_time" | "annual" | "monthly"; kind?: "service" | "government_fee" };

export function OrderSummary({ lines, footnote }: { lines: SummaryLine[]; footnote?: ReactNode }) {
  const total = lines.reduce((n, l) => n + l.amountCents, 0);
  const recurring = lines.filter((l) => l.billing !== "one_time");
  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-sans text-base font-semibold">Order summary</h2>
      <dl className="mt-4 space-y-3 text-[15px]">
        {lines.map((l) => (
          <div key={l.description} className="flex justify-between gap-4">
            <dt className="text-ink">
              {l.description}
              {l.kind === "government_fee" ? <span className="block text-xs text-muted">Government fee, passed through at cost</span> : null}
            </dt>
            <dd className="shrink-0 tabular-nums">{formatMoney(l.amountCents)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-between border-t border-line pt-4 text-base font-semibold">
        <span>Due today</span>
        <span className="tabular-nums">{formatMoney(total)}</span>
      </div>
      {recurring.length ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {recurring.map((r) => `${r.description.replace(/ \(first (year|month)\)$/, "")} renews at ${formatMoney(r.amountCents)}/${r.billing === "monthly" ? "month" : "year"}`).join(". ")}.
          {" "}You can turn off auto-renewal anytime from your account.
        </p>
      ) : null}
      {footnote ? <div className="mt-3 text-xs leading-relaxed text-muted">{footnote}</div> : null}
    </div>
  );
}
