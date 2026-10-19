"use client";

import { CopyButton } from "@/components/ui/copy-button";

export type EntrySheetData = Array<{ title: string; fields: Array<{ label: string; value: string }> }>;

/** The data an admin types into the wholesale partner's dashboard, with one-click copy. */
export function EntrySheet({ sheet }: { sheet: EntrySheetData }) {
  const all = sheet
    .map((s) => [`## ${s.title}`, ...s.fields.filter((f) => f.value).map((f) => `${f.label}: ${f.value}`)].join("\n"))
    .join("\n\n");
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <CopyButton value={all} label="Copy all" />
      </div>
      {sheet.map((section) => (
        <section key={section.title}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{section.title}</h3>
          <dl className="divide-y divide-line rounded-md border border-line">
            {section.fields.map((f, i) => (
              <div key={`${f.label}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="w-40 shrink-0 text-sm text-muted">{f.label}</dt>
                <dd className="min-w-0 flex-1 break-words font-mono text-[13px] text-ink">{f.value || <span className="text-subtle">—</span>}</dd>
                {f.value ? <CopyButton value={f.value} /> : null}
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
