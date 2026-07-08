"use client";

import { ExportXlsxButton } from "@/components/ui/export-xlsx-button";
import { formatDate } from "@/lib/utils";
import type { PaymentRow } from "@/lib/data/payments";

export function PaymentsExportButton({ total }: { total: number }) {
  return (
    <ExportXlsxButton<PaymentRow>
      endpoint="/api/payments"
      filenamePrefix="AIMS-payments"
      sheetName="Payments"
      total={total}
      columns={[
        { header: "Container No", value: (r) => r.containerNo },
        { header: "BL No", value: (r) => r.blNo },
        { header: "Supplier", value: (r) => r.supplierName },
        { header: "Requested", value: (r) => r.amountRequested },
        { header: "Paid", value: (r) => r.amountPaid },
        { header: "Outstanding", value: (r) => r.outstanding },
        { header: "Currency", value: (r) => r.currency },
        { header: "Status", value: (r) => r.status },
        { header: "Approval", value: (r) => r.approvalStatus },
        { header: "Request Date", value: (r) => (r.requestDate ? formatDate(r.requestDate) : "") },
        { header: "Due Date", value: (r) => (r.dueDate ? formatDate(r.dueDate) : "") },
        { header: "Paid Date", value: (r) => (r.paidDate ? formatDate(r.paidDate) : "") },
        { header: "Reference", value: (r) => r.reference },
      ]}
    />
  );
}
