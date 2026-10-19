import type { ReactNode } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const CHECKOUT_STEP_LABELS = ["Company", "Contact", "Account", "Payment"];

/**
 * Checkout progress. `current` is the index of the active step; pass
 * `current={labels.length}` to show every step complete. Completed steps become
 * buttons when `onSelect` is given.
 */
export function CheckoutProgress({
  current,
  labels = CHECKOUT_STEP_LABELS,
  onSelect,
}: {
  current: number;
  labels?: string[];
  onSelect?: (index: number) => void;
}) {
  const shown = Math.min(current, labels.length - 1);
  return (
    <nav aria-label="Checkout progress">
      {/* Phones: compact bar */}
      <div className="sm:hidden">
        <p className="text-sm font-medium text-ink">
          {current >= labels.length ? "All steps complete" : `Step ${shown + 1} of ${labels.length}: ${labels[shown]}`}
        </p>
        <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }} aria-hidden>
          {labels.map((l, i) => (
            <span key={l} className={cn("h-1.5 rounded-full", i < current ? "bg-accent" : i === current ? "bg-brand" : "bg-line-strong")} />
          ))}
        </div>
      </div>
      {/* Larger screens: labelled steps */}
      <ol className="hidden items-center gap-2 text-sm sm:flex">
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const marker = (
            <>
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-accent bg-accent text-white",
                  active && "border-brand bg-surface text-brand",
                  !done && !active && "border-line-strong text-subtle",
                )}
              >
                {done ? <CheckIcon size={14} /> : i + 1}
              </span>
              <span className={cn(active ? "font-semibold text-ink" : done ? "text-ink" : "text-muted")}>
                {label}
                {done ? <span className="sr-only"> (complete)</span> : null}
              </span>
            </>
          );
          return (
            <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              {done && onSelect ? (
                <button type="button" onClick={() => onSelect(i)} className="flex items-center gap-2 rounded-md py-1 pr-1 hover:underline">
                  {marker}
                </button>
              ) : (
                <span className="flex items-center gap-2 py-1">{marker}</span>
              )}
              {i < labels.length - 1 ? <span className="mx-1 h-px w-8 bg-line-strong" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type SummaryLine = { description: string; amountCents: number; billing: "one_time" | "annual" | "monthly"; kind?: "service" | "government_fee" };

export function summaryTotal(lines: SummaryLine[]) {
  return lines.reduce((n, l) => n + l.amountCents, 0);
}

export function OrderSummary({
  lines,
  heading = "Order summary",
  subject,
  footnote,
  className,
}: {
  lines: SummaryLine[];
  heading?: string | null;
  /** e.g. "Lone Star Widgets LLC · Texas" */
  subject?: string;
  footnote?: ReactNode;
  className?: string;
}) {
  const total = summaryTotal(lines);
  const recurring = lines.filter((l) => l.billing !== "one_time");
  const governmentFees = lines.filter((l) => l.kind === "government_fee").reduce((n, l) => n + l.amountCents, 0);
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5 sm:p-6", className)}>
      {heading ? <h2 className="font-sans text-base font-semibold">{heading}</h2> : null}
      {subject ? <p className="mt-1 break-words text-sm text-muted">{subject}</p> : null}
      <dl className={cn("space-y-3 text-[15px]", heading || subject ? "mt-4" : null)}>
        {lines.map((l) => (
          <div key={l.description} className="flex justify-between gap-4">
            <dt className="min-w-0 text-ink">
              {l.description}
              {l.kind === "government_fee" ? <span className="block text-xs text-muted">Government fee, paid to the state at cost</span> : null}
            </dt>
            <dd className="shrink-0 tabular-nums">{formatMoney(l.amountCents)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-between border-t border-line pt-4 text-base font-semibold">
        <span>Due today</span>
        <span className="tabular-nums">{formatMoney(total)}</span>
      </div>
      {governmentFees > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Includes {formatMoney(governmentFees)} in government fees and {formatMoney(total - governmentFees)} in service fees.
        </p>
      ) : null}
      {recurring.length ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {recurring
            .map((r) => `${r.description.replace(/ \(first (year|month)\)$/, "")} renews at ${formatMoney(r.amountCents)}/${r.billing === "monthly" ? "month" : "year"}`)
            .join(". ")}
          . You can turn off auto-renewal anytime from your account.
        </p>
      ) : null}
      {footnote ? <div className="mt-3 text-xs leading-relaxed text-muted">{footnote}</div> : null}
    </div>
  );
}
