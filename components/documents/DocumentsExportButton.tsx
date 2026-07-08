"use client";

import { ExportXlsxButton } from "@/components/ui/export-xlsx-button";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { DocumentRow } from "@/lib/data/documents";

export function DocumentsExportButton({ total }: { total: number }) {
  return (
    <ExportXlsxButton<DocumentRow>
      endpoint="/api/documents"
      filenamePrefix="AIMS-documents"
      sheetName="Documents"
      total={total}
      columns={[
        { header: "Type", value: (r) => DOCUMENT_TYPE_LABELS[r.type] ?? r.type },
        { header: "Doc No", value: (r) => r.docNo },
        { header: "Container No", value: (r) => r.containerNo },
        { header: "BL No", value: (r) => r.blNo },
        { header: "Supplier", value: (r) => r.supplierName },
        { header: "Issue Date", value: (r) => (r.issueDate ? formatDate(r.issueDate) : "") },
        { header: "Expiry Date", value: (r) => (r.expiryDate ? formatDate(r.expiryDate) : "") },
        { header: "Status", value: (r) => r.status },
        { header: "File Name", value: (r) => r.fileName },
      ]}
    />
  );
}
