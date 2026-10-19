import { Table, Td, Th } from "@/components/ui/table";
import { DownloadIcon } from "@/components/ui/icons";
import type { DocumentRow } from "@/db/schema";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { formatBytes, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function DocumentsTable({
  docs,
  showVisibility = false,
  renderActions,
}: {
  docs: DocumentRow[];
  showVisibility?: boolean;
  renderActions?: (doc: DocumentRow) => React.ReactNode;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Document</Th>
          <Th>Type</Th>
          <Th>Added</Th>
          <Th className="text-right">Download</Th>
          {renderActions ? <Th className="text-right">Manage</Th> : null}
        </tr>
      </thead>
      <tbody>
        {docs.map((d) => (
          <tr key={d.id}>
            <Td>
              <span className="font-medium">{d.title}</span>
              <span className="block text-xs text-muted">
                {d.originalFilename} · {formatBytes(d.sizeBytes)}
              </span>
              {showVisibility && d.visibility === "internal" ? <Badge className="mt-1">Internal only</Badge> : null}
            </Td>
            <Td>{DOCUMENT_TYPE_LABEL[d.type]}</Td>
            <Td>{formatDate(d.createdAt)}</Td>
            <Td className="text-right">
              <div className="flex justify-end gap-3">
                {d.mimeType === "application/pdf" ? (
                  <a href={`/api/documents/${d.id}/download?inline=1`} target="_blank" rel="noopener" className="text-sm text-brand hover:underline">
                    View
                  </a>
                ) : null}
                <a href={`/api/documents/${d.id}/download`} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline" aria-label={`Download ${d.title}`}>
                  <DownloadIcon size={16} /> Download
                </a>
              </div>
            </Td>
            {renderActions ? <Td className="text-right">{renderActions(d)}</Td> : null}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
