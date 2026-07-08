import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Target,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listCustomers } from "@/lib/data/customers";
import {
  listPriceLists,
  listSalesOrders,
  type PriceListRow,
  type SalesOrderRow,
} from "@/lib/data/sales";
import { listReceivableCustomers, type ReceivableCustomerRow } from "@/lib/data/receivables";
import { listWarehouses, type WarehouseRecord } from "@/lib/data/warehouses";
import { cn, formatINR } from "@/lib/utils";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function SalesModulePage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["sales.view"]);
  const showFinancials = can(session.role, "financials.view");

  let loadError = false;
  let priceLists: PriceListRow[] = [];
  let orders: SalesOrderRow[] = [];
  let receivables: ReceivableCustomerRow[] = [];
  let warehouses: WarehouseRecord[] = [];
  let customerCount = 0;

  try {
    [priceLists, orders, receivables, warehouses, customerCount] = await Promise.all([
      listPriceLists(session.orgId),
      listSalesOrders(session.orgId, session.role === "sales_executive" ? session.userId : undefined),
      listReceivableCustomers(session.orgId),
      listWarehouses(session.orgId),
      listCustomers(session.orgId, session.role === "sales_executive" ? session.userId : undefined).then((rows) => rows.length),
    ]);
  } catch (err) {
    console.error("[sales/page] load failed", err);
    loadError = true;
  }

  const today = new Date().toISOString().slice(0, 10);
  const publishedToday = priceLists.filter(
    (row) => row.priceDate === today && row.status === "Published"
  );
  const latestPublished = priceLists.find((row) => row.status === "Published");
  const warehouseBenchmarks = warehouses.map((warehouse) => {
    const warehousePrices = priceLists.filter((row) => row.warehouseId === warehouse.id);
    const published = warehousePrices.filter((row) => row.status === "Published");
    const latest = published[0] ?? warehousePrices[0] ?? null;
    const warehouseOrders = orders.filter((order) => order.warehouseId === warehouse.id);
    const avgDiscountPct =
      warehouseOrders.length > 0
        ? (warehouseOrders.reduce((sum, order) => {
            if (!order.grossAmount || !order.discountAmount || order.grossAmount <= 0) return sum;
            return sum + (order.discountAmount / order.grossAmount) * 100;
          }, 0) / warehouseOrders.length)
        : null;
    return {
      ...warehouse,
      latest,
      publishedCount: published.length,
      ordersCount: warehouseOrders.length,
      avgDiscountPct,
    };
  });
  const openOrders = orders.filter(
    (order) => order.approvalStatus !== "Rejected" && order.approvalStatus !== "Approved"
  );
  const approvedOrders = orders.filter((order) => order.approvalStatus === "Approved");
  const creditHoldCustomers = receivables.filter((row) => row.creditHold).length;
  const outstandingAr = receivables.reduce((sum, row) => sum + row.outstanding, 0);
  const maxUtilization =
    receivables.length > 0
      ? Math.max(
          ...receivables.map((row) =>
            row.creditLimit && row.creditLimit > 0
              ? (row.outstanding / row.creditLimit) * 100
              : 0
          )
        )
      : 0;

  return (
    <div>
      <PageHeader
        title="Sales Module"
        description="Quotes, pricing discipline, receivables visibility, and customer credit control."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/orders">
                Open price desk <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/quotes">Quotes</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/receipts">Receivables</Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
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
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Customers" value={customerCount.toString()} hint="Master records" />
              <Metric label="Published today" value={publishedToday.length.toString()} hint="Benchmark lines" />
              <Metric label="Open orders" value={openOrders.length.toString()} hint="In flight" />
              {showFinancials ? (
                <Metric label="AR Outstanding" value={formatINR(outstandingAr)} hint="Receivables" tone="text-danger" />
              ) : (
                <Metric label="AR Outstanding" value="Restricted" hint="Financials hidden" />
              )}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
              <Card className="rounded-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="label-caps">Daily benchmarking</p>
                      <h2 className="mt-1 font-heading text-xl font-semibold">
                        Day-price desk and live benchmark
                      </h2>
                    </div>
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <BenchmarkCard
                      label="Published today"
                      value={publishedToday.length.toString()}
                      hint="Price lists active for the current day"
                    />
                    <BenchmarkCard
                      label="Latest published"
                      value={latestPublished ? latestPublished.warehouseName : "None"}
                      hint={latestPublished ? `${latestPublished.priceDate} · ${latestPublished.itemCount} rows` : "No published list yet"}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <div>
                      <p className="font-medium">Daily price desk lives in Sales Orders</p>
                      <p className="text-sm text-muted-foreground">
                        Publish warehouse-wise day prices, floor prices, benchmarks, and discount limits before order entry.
                      </p>
                    </div>
                    <Button asChild size="sm">
                      <Link href="/orders">Create or publish day price</Link>
                    </Button>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface">
                        <tr className="text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Warehouse</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium text-right">Items</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceLists.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8">
                              <EmptyState
                                icon={BarChart3}
                                title="No price lists yet"
                                description="Publish a day price from Sales Orders to activate warehouse benchmarking and order pricing."
                                className="border-0 bg-transparent py-4"
                              />
                            </td>
                          </tr>
                        ) : (
                          priceLists.slice(0, 6).map((row) => (
                            <tr key={row.id} className="border-t border-border/60">
                              <td className="px-4 py-3 font-medium">{row.warehouseName}</td>
                              <td className="px-4 py-3 font-financial">{row.priceDate}</td>
                              <td className="px-4 py-3 text-right font-financial">{row.itemCount}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                                    row.status === "Published"
                                      ? "bg-success/10 text-success"
                                      : row.status === "Archived"
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-warning/10 text-[#9A6212]"
                                  )}
                                >
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-lg border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
                      <div>
                        <p className="label-caps">Per-warehouse benchmark</p>
                        <h3 className="mt-1 font-heading text-base font-semibold">
                          Pricing rhythm and discount discipline
                        </h3>
                      </div>
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface">
                        <tr className="text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Warehouse</th>
                          <th className="px-4 py-3 font-medium">Latest day price</th>
                          <th className="px-4 py-3 font-medium text-right">Published</th>
                          <th className="px-4 py-3 font-medium text-right">Orders</th>
                          <th className="px-4 py-3 font-medium text-right">Avg discount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warehouseBenchmarks.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8">
                              <EmptyState
                                icon={BarChart3}
                                title="No warehouse data"
                                description="Warehouse benchmarks appear once warehouses and price lists are available."
                                className="border-0 bg-transparent py-4"
                              />
                            </td>
                          </tr>
                        ) : (
                          warehouseBenchmarks.map((warehouse) => (
                            <tr key={warehouse.id} className="border-t border-border/60">
                              <td className="px-4 py-3">
                                <p className="font-medium">{warehouse.name}</p>
                                <p className="text-xs text-muted-foreground">{warehouse.code} · {warehouse.city}</p>
                              </td>
                              <td className="px-4 py-3 font-financial">
                                {warehouse.latest ? `${warehouse.latest.priceDate} · ${warehouse.latest.status}` : "No list"}
                              </td>
                              <td className="px-4 py-3 text-right font-financial">{warehouse.publishedCount}</td>
                              <td className="px-4 py-3 text-right font-financial">{warehouse.ordersCount}</td>
                              <td className={cn("px-4 py-3 text-right font-financial", warehouse.avgDiscountPct != null && warehouse.avgDiscountPct > 8 ? "text-warning" : "text-success")}>
                                {warehouse.avgDiscountPct == null ? "—" : `${warehouse.avgDiscountPct.toFixed(1)}%`}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-lg border-danger/20 bg-danger/5">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-danger" />
                      <h3 className="font-heading text-lg font-semibold">
                        Credit control
                      </h3>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <SmallStat label="Receivables customers" value={receivables.length.toString()} />
                      <SmallStat label="Credit hold" value={creditHoldCustomers.toString()} />
                      <SmallStat label="Max utilization" value={`${maxUtilization.toFixed(1)}%`} />
                      <SmallStat label="Approved orders" value={approvedOrders.length.toString()} />
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      This is where the team sees who can still buy, who is blocked,
                      and how much exposure exists against each customer limit.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href="/customers">Open customer master</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/receipts">Open collections</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-primary" />
                      <h3 className="font-heading text-lg font-semibold">
                        Commercial shortcuts
                      </h3>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <Shortcut href="/quotes" icon={ReceiptText} label="Quotes and amendments" />
                      <Shortcut href="/orders" icon={ShoppingCart} label="Sales orders and approvals" />
                      <Shortcut href="/customers" icon={Target} label="Customer risk and history" />
                      <Shortcut href="/warehouse" icon={PackageSearch} label="Stock and price matching" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {showFinancials && (
              <Card className="rounded-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="label-caps">Receivables watch</p>
                      <h3 className="mt-1 font-heading text-lg font-semibold">
                        Customers carrying balance or limit pressure
                      </h3>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/receipts">View full ledger</Link>
                    </Button>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface">
                        <tr className="text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Customer</th>
                          <th className="px-4 py-3 font-medium text-right">Limit</th>
                          <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                          <th className="px-4 py-3 font-medium text-right">Utilization</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receivables.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8">
                              <EmptyState
                                icon={CreditCard}
                                title="No receivables yet"
                                description="Once sales orders and receipts are active, this panel will show customer exposure."
                                className="border-0 bg-transparent py-4"
                              />
                            </td>
                          </tr>
                        ) : (
                          receivables.slice(0, 8).map((row) => {
                            const utilization =
                              row.creditLimit && row.creditLimit > 0
                                ? Math.min((row.outstanding / row.creditLimit) * 100, 999)
                                : null;
                            const tone =
                              row.creditHold
                                ? "text-danger"
                                : utilization == null
                                  ? "text-muted-foreground"
                                  : utilization >= 100
                                    ? "text-danger"
                                    : utilization >= 85
                                      ? "text-warning"
                                      : utilization >= 60
                                        ? "text-[#9A6212]"
                                        : "text-success";
                            return (
                              <tr key={row.id} className="border-t border-border/60">
                                <td className="px-4 py-3">
                                  <Link
                                    href={`/customers/${row.id}`}
                                    className="font-medium hover:text-primary"
                                  >
                                    {row.name}
                                  </Link>
                                  <p className="text-xs text-muted-foreground">
                                    {row.code} · {row.region ?? "No region"}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-right font-financial">
                                  {formatINR(row.creditLimit)}
                                </td>
                                <td className="px-4 py-3 text-right font-financial">
                                  {formatINR(row.outstanding)}
                                </td>
                                <td className={cn("px-4 py-3 text-right font-financial", tone)}>
                                  {utilization == null ? "—" : `${utilization.toFixed(1)}%`}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                                      row.creditHold
                                        ? "bg-danger/10 text-danger"
                                        : utilization != null && utilization >= 100
                                          ? "bg-danger/10 text-danger"
                                          : utilization != null && utilization >= 85
                                            ? "bg-warning/15 text-[#9A6212]"
                                            : "bg-success/10 text-success"
                                    )}
                                  >
                                    {row.creditHold
                                      ? "Credit hold"
                                      : utilization != null && utilization >= 100
                                        ? "Over limit"
                                        : utilization != null && utilization >= 85
                                          ? "High risk"
                                          : "Healthy"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("font-financial mt-1 text-2xl font-bold", tone)}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function BenchmarkCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-4">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-heading text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-financial mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Shortcut({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof ReceiptText;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <span className="flex items-center gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
