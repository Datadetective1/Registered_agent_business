import type { ReactNode } from "react";
import type { Tone } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

const tones: Record<Tone, string> = {
  neutral: "bg-sand border-line text-ink",
  info: "bg-info-bg border-info-fg/20 text-info-fg",
  success: "bg-success-bg border-success-fg/20 text-success-fg",
  warning: "bg-warning-bg border-warning-fg/25 text-warning-fg",
  danger: "bg-danger-bg border-danger-fg/20 text-danger-fg",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const Icon = tone === "success" ? CheckIcon : tone === "info" || tone === "neutral" ? InfoIcon : AlertIcon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-md border px-4 py-3 text-sm", tones[tone], className)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 space-y-1 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink/90">{children}</div> : null}
      </div>
    </div>
  );
}
