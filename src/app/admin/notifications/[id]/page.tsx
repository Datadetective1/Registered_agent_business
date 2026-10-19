import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, PageHeader } from "@/components/ui/layout";
import { formatDateTime } from "@/lib/utils";
import { getNotification } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Email" };

export default async function NotificationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const n = await getNotification(id);
  if (!n) notFound();
  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/admin/notifications" className="hover:text-ink">
          Email outbox
        </Link>{" "}
        / {n.template}
      </nav>
      <PageHeader title={n.subject} actions={<Badge>{n.status}</Badge>} />
      <Card>
        <CardBody>
          <DescriptionList
            items={[
              ["To", n.toAddress],
              ["Template", <span key="t" className="font-mono text-sm">{n.template}</span>],
              ["Transport", n.transport],
              ["Created", formatDateTime(n.createdAt)],
              ["Sent", formatDateTime(n.sentAt)],
              ["Error", n.error ?? "—"],
              ["Order", n.orderId ? <Link key="o" href={`/admin/orders/${n.orderId}`} className="text-brand hover:underline">View order</Link> : "—"],
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="HTML preview" description="Rendered in a sandboxed frame." />
        <CardBody>
          <iframe title="Email preview" sandbox="" srcDoc={n.bodyHtml} className="h-[640px] w-full rounded-md border border-line bg-white" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Plain-text version" />
        <CardBody>
          <pre className="whitespace-pre-wrap text-sm">{n.bodyText}</pre>
        </CardBody>
      </Card>
    </div>
  );
}
