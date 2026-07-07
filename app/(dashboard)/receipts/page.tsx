import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listReceivableCustomers, listCustomerReceipts, type ReceivableCustomerRow, type CustomerReceiptRow } from "@/lib/data/receivables";
import { ReceivablesWorkspace } from "@/components/receipts/ReceivablesWorkspace";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["receipts.view"]);
  const canAccess = true;

  let customers: ReceivableCustomerRow[] = [];
  let receipts: CustomerReceiptRow[] = [];
  let loadError = false;

  try {
    [customers, receipts] = await Promise.all([
      listReceivableCustomers(session.orgId),
      listCustomerReceipts(session.orgId),
    ]);
  } catch (err) {
    console.error("[receipts/page] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Record customer collections, allocate them to sales orders, and keep the receivables ledger current."
      />

      <div className="space-y-4 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load receipts</p>
              <p className="text-muted-foreground">
                The database isn&apos;t reachable from this environment. Set a
                reachable <code>DATABASE_URL</code> and try again.
              </p>
            </div>
          </div>
        ) : !canAccess ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            You do not have permission to view customer receipts.
          </div>
        ) : (
          <ReceivablesWorkspace
            customers={customers}
            receipts={receipts}
            canRecord={can(session.role, "receipt.record")}
            canViewFinancials={can(session.role, "financials.view")}
          />
        )}
      </div>
    </div>
  );
}
