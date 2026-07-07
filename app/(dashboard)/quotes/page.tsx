import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listCustomers, type CustomerRecord } from "@/lib/data/customers";
import { listPriceLists, type PriceListRow } from "@/lib/data/sales";
import { listSalesQuotes, type SalesQuoteRow } from "@/lib/data/quotes";
import { listWarehouses, type WarehouseRecord } from "@/lib/data/warehouses";
import { listStockItems, type StockItemRow } from "@/lib/data/stock";
import { QuoteWorkspace } from "@/components/orders/QuoteWorkspace";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["sales.view"]);
  const canAccess = true;

  let loadError = false;
  let warehouses: WarehouseRecord[] = [];
  let customers: CustomerRecord[] = [];
  let stockItems: StockItemRow[] = [];
  let priceLists: PriceListRow[] = [];
  let quotes: SalesQuoteRow[] = [];

  try {
    [warehouses, customers, stockItems, priceLists, quotes] = await Promise.all([
      listWarehouses(session.orgId),
      listCustomers(session.orgId, session.role === "sales_executive" ? session.userId : undefined),
      listStockItems(session.orgId).then((rows) => rows.filter((row) => row.qualityStatus === "Released")),
      listPriceLists(session.orgId),
      listSalesQuotes(session.orgId, session.role === "sales_executive" ? session.userId : undefined),
    ]);
  } catch (err) {
    console.error("[quotes/page] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Draft, amend, approve, and convert sales quotes into orders with a revision trail."
      />

      <div className="space-y-4 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load quotes</p>
              <p className="text-muted-foreground">
                Quote data could not be loaded. Retry once; if it continues, ask an administrator to review the server log.
              </p>
            </div>
          </div>
        ) : !canAccess ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            You do not have permission to view quotes.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Quotes" value={quotes.length.toString()} hint="All quote records" />
              <StatCard label="Approved" value={quotes.filter((quote) => quote.approvalStatus === "Approved").length.toString()} hint="Ready to convert" />
              <StatCard label="Draft" value={quotes.filter((quote) => quote.approvalStatus === "Draft").length.toString()} hint="Open revisions" />
              <StatCard label="Forecast" value={quotes.reduce((sum, quote) => sum + (quote.netAmount ?? 0), 0).toLocaleString("en-IN")} hint="Gross quote value" />
            </div>

            <QuoteWorkspace
              warehouses={warehouses}
              customers={customers}
              stockItems={stockItems}
              priceLists={priceLists}
              quotes={quotes}
              canWrite={can(session.role, "salesorder.write")}
              canApprove={can(session.role, "salesorder.approve")}
            />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-financial mt-1 text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
