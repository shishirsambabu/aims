import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listCustomers, type CustomerRecord } from "@/lib/data/customers";
import { listStockItems, type StockItemRow } from "@/lib/data/stock";
import { listWarehouses, type WarehouseRecord } from "@/lib/data/warehouses";
import { listPriceLists, listSalesOrders, type PriceListRow, type SalesOrderRow } from "@/lib/data/sales";
import { SalesWorkspace } from "@/components/orders/SalesWorkspace";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["sales.view"]);
  const canAccess = true;

  let loadError = false;
  let warehouses: WarehouseRecord[] = [];
  let customers: CustomerRecord[] = [];
  let stockItems: StockItemRow[] = [];
  let priceLists: PriceListRow[] = [];
  let orders: SalesOrderRow[] = [];

  try {
    [warehouses, customers, stockItems, priceLists, orders] = await Promise.all([
      listWarehouses(session.orgId),
      listCustomers(session.orgId, session.role === "sales_executive" ? session.userId : undefined),
      listStockItems(session.orgId).then((rows) => rows.filter((row) => row.qualityStatus === "Released")),
      listPriceLists(session.orgId),
      listSalesOrders(session.orgId, session.role === "sales_executive" ? session.userId : undefined),
    ]);
  } catch (err) {
    console.error("[orders/page] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="Publish day prices, reserve cold-store stock, and move approved orders into the container profit trail."
      />

      <div className="space-y-4 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load sales data</p>
              <p className="text-muted-foreground">
                Sales data could not be loaded. Retry once; if it continues, ask an administrator to review the server log.
              </p>
            </div>
          </div>
        ) : !canAccess ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            You do not have permission to view sales orders.
          </div>
        ) : (
          <SalesWorkspace
            warehouses={warehouses}
            customers={customers}
            stockItems={stockItems}
            priceLists={priceLists}
            orders={orders}
            canWrite={can(session.role, "salesorder.write")}
            canApprove={can(session.role, "salesorder.approve")}
            canPublish={can(session.role, "price.publish")}
            canViewFloor={can(session.role, "price.floor.view") || can(session.role, "financials.view")}
          />
        )}
      </div>
    </div>
  );
}
