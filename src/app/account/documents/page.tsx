import { DocumentsTable } from "@/components/account/documents-table";
import { UploadDocumentForm } from "@/components/account/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { requireCustomer } from "@/server/auth/guards";
import { listEntitiesWithServices } from "@/server/customer";
import { listCustomerDocuments } from "@/server/documents";

export default async function DocumentsPage() {
  const session = await requireCustomer("/account/documents");
  const [docs, entities] = await Promise.all([listCustomerDocuments(session.customer.id), listEntitiesWithServices(session.customer.id)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Legal papers, state correspondence and filed documents for your businesses." />
      {docs.length ? <DocumentsTable docs={docs} /> : <EmptyState title="No documents yet">When documents arrive for your businesses, they&apos;ll appear here and we&apos;ll email you.</EmptyState>}
      <Card>
        <CardHeader title="Upload a document" />
        <CardBody>
          <UploadDocumentForm entities={entities.map((e) => ({ id: e.entity.id, name: e.entity.legalName }))} />
        </CardBody>
      </Card>
    </div>
  );
}
