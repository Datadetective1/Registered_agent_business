import type { ReactNode } from "react";
import type { Tone } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const tones: Record<Tone, string> = {
  neutral: "bg-sand text-muted ring-line-strong",
  info: "bg-info-bg text-info-fg ring-info-fg/20",
  success: "bg-success-bg text-success-fg ring-success-fg/20",
  warning: "bg-warning-bg text-warning-fg ring-warning-fg/20",
  danger: "bg-danger-bg text-danger-fg ring-danger-fg/20",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
