import Link from "next/link";
import { notFound } from "next/navigation";
import { setSupportStatusAction } from "@/app/admin/actions";
import { NoteForm } from "@/components/admin/forms";
import { NotesList } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, PageHeader } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { SUPPORT_CATEGORY_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { getSupport } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Support request" };

export default async function SupportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const d = await getSupport(id);
  if (!d) notFound();
  const r = d.request;
  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/admin/support" className="hover:text-ink">
          Support
        </Link>{" "}
        / {r.subject}
      </nav>
      <PageHeader title={r.subject} actions={<Badge tone={r.status === "open" ? "warning" : "neutral"}>{r.status}</Badge>} />
      <Card>
        <CardBody className="space-y-4">
          <DescriptionList
            items={[
              ["From", `${r.name} <${r.email}>`],
              ["Phone", r.phone ?? "—"],
              ["Topic", SUPPORT_CATEGORY_LABEL[r.category]],
              ["Received", formatDateTime(r.createdAt)],
              ["Source", r.source],
              ["Customer", r.customerId ? <Link key="c" href={`/admin/customers/${r.customerId}`} className="text-brand hover:underline">View customer</Link> : "Not signed in"],
              ["Order", r.orderId ? <Link key="o" href={`/admin/orders/${r.orderId}`} className="text-brand hover:underline">View order</Link> : "—"],
            ]}
          />
          <div className="whitespace-pre-wrap rounded-md bg-sand p-4 text-[15px]">{r.message}</div>
          <div className="flex flex-wrap gap-2">
            <a className={buttonClasses("primary", "sm")} href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.subject}`)}`}>
              Reply by email
            </a>
            {(["open", "pending", "closed"] as const)
              .filter((s) => s !== r.status)
              .map((s) => (
                <form key={s} action={setSupportStatusAction.bind(null, r.id, s)}>
                  <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                    Mark {s}
                  </SubmitButton>
                </form>
              ))}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Internal notes" />
        <CardBody className="space-y-4">
          <NotesList notes={d.notes} />
          <NoteForm target={{ supportRequestId: r.id, customerId: r.customerId ?? undefined }} />
        </CardBody>
      </Card>
    </div>
  );
}
