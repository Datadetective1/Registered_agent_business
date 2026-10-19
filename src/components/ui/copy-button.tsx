"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "./icons";

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard unavailable (e.g. insecure context); the value is still selectable.
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs font-medium text-muted hover:bg-sand hover:text-ink",
        className,
      )}
      aria-label={copied ? "Copied" : `${label}: ${value.slice(0, 40)}`}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {copied ? "Copied" : label}
    </button>
  );
}
