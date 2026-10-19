import Link from "next/link";
import { setDocumentStateAction } from "@/app/admin/actions";
import type { AdminNote, AuditEvent } from "@/db/schema";
import { cn, formatDateTime } from "@/lib/utils";

export function AuditList({ events }: { events: Array<{ event: AuditEvent; actor: string | null }> }) {
  if (!events.length) return <p className="text-sm text-muted">No events yet.</p>;
  return (
    <ol className="space-y-2.5">
      {events.map(({ event, actor }) => (
        <li key={event.id} className="text-sm">
          <span className="font-mono text-[12px] text-ink">{event.action}</span>
          <span className="text-muted">
            {" "}
            · {actor ?? event.actorType} · {formatDateTime(event.createdAt)}
          </span>
          {Object.keys(event.metadata ?? {}).length ? (
            <pre className="mt-1 overflow-x-auto rounded bg-sand px-2 py-1 text-[11px] leading-snug text-muted">{JSON.stringify(event.metadata)}</pre>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function NotesList({ notes }: { notes: Array<{ note: AdminNote; author: string | null }> }) {
  if (!notes.length) return <p className="text-sm text-muted">No notes yet.</p>;
  return (
    <ul className="space-y-3">
      {notes.map(({ note, author }) => (
        <li key={note.id} className="rounded-md border border-line bg-paper px-3 py-2">
          <p className="whitespace-pre-wrap text-[15px]">{note.body}</p>
          <p className="mt-1 text-xs text-muted">
            {author ?? "system"} · {formatDateTime(note.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function SearchForm({ action, q, placeholder, hidden }: { action: string; q?: string; placeholder: string; hidden?: Record<string, string> }) {
  return (
    <form action={action} method="get" className="flex max-w-md gap-2" role="search">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="q" className="sr-only">
        Search
      </label>
      <input id="q" name="q" defaultValue={q} placeholder={placeholder} className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[15px]" />
      <button type="submit" className="h-10 rounded-md border border-line-strong bg-surface px-4 text-sm hover:bg-sand">
        Search
      </button>
    </form>
  );
}

export function FilterTabs({ base, param, current, options }: { base: string; param: string; current: string; options: Array<{ value: string; label: string; count?: number }> }) {
  return (
    <nav className="-mx-1 flex flex-wrap gap-1" aria-label="Filter">
      {options.map((o) => (
        <Link
          key={o.value}
          href={`${base}?${param}=${o.value}`}
          aria-current={current === o.value ? "page" : undefined}
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            current === o.value ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-sand",
          )}
        >
          {o.label}
          {o.count !== undefined ? <span className="ml-1 opacity-75">({o.count})</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function stripeDashboardUrl(kind: "payments" | "subscriptions" | "customers" | "invoices", id: string): string {
  const test = (process.env.STRIPE_SECRET_KEY ?? "").includes("_test_");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}${kind}/${id}`;
}

/** Share with / hide from the customer. */
export function DocumentVisibilityToggle({ id, visibility }: { id: string; visibility: "customer" | "internal" }) {
  return (
    <form action={setDocumentStateAction.bind(null, id, { visibility: visibility === "customer" ? "internal" : "customer" })}>
      <button type="submit" className="text-sm text-brand hover:underline">
        {visibility === "customer" ? "Hide from customer" : "Share with customer"}
      </button>
    </form>
  );
}
