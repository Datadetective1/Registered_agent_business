import { Badge } from "@/components/ui/badge";
import { CheckIcon } from "@/components/ui/icons";
import type { EntityServiceStatus, OrderStatus, SubscriptionStatus } from "@/db/schema";
import { ENTITY_SERVICE_STATUS, SUBSCRIPTION_STATUS } from "@/lib/labels";
import { ORDER_PROGRESS, ORDER_STATUS, progressIndex } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status, audience = "customer" }: { status: OrderStatus; audience?: "customer" | "admin" }) {
  const meta = ORDER_STATUS[status];
  return <Badge tone={meta.tone}>{audience === "admin" ? meta.label : meta.customerLabel}</Badge>;
}

export function ServiceStatusBadge({ status }: { status: EntityServiceStatus }) {
  const meta = ENTITY_SERVICE_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const meta = SUBSCRIPTION_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Horizontal progress tracker for the customer's order page. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "cancelled" || status === "refunded" || status === "new") return null;
  const current = progressIndex(status);
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Order progress">
      {ORDER_PROGRESS.map((step, i) => {
        // Steps up to the current milestone are done; the next one is in progress.
        const done = i <= current;
        const active = i === current + 1;
        return (
          <li key={step.status} className="flex flex-col items-center gap-2 text-center">
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                done && "border-accent bg-accent text-white",
                active && "border-brand bg-surface text-brand",
                !done && !active && "border-line-strong bg-surface text-subtle",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <CheckIcon size={16} /> : i + 1}
            </span>
            <span className={cn("text-xs leading-tight sm:text-sm", active ? "font-medium text-ink" : "text-muted")}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
