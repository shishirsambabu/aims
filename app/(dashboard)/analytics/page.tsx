import {
  Package,
  Receipt,
  TrendingUp,
  Percent,
  FileWarning,
  CreditCard,
  AlertTriangle,
  Clock,
  Ship,
  BarChart3,
  DatabaseZap,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { KPICard } from "@/components/dashboard/KPICard";
import { AnalyticsCharts } from "@/components/dashboard/AnalyticsCharts";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { getAnalytics, type Analytics } from "@/lib/data/analytics";
import { cn, formatINR, formatMoney, marginColor } from "@/lib/utils";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["financials.view"]);
  const { orgId } = session;

  let data: Analytics | null = null;
  let loadError = false;
  try {
    data = await getAnalytics(orgId);
  } catch (err) {
    console.error("[analytics/page] load failed", err);
    loadError = true;
  }

  if (loadError || !data) {
    return (
      <div>
        <PageHeader title="Analytics" description="Profit, volume and supplier performance." />
        <div className="m-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
          <p className="text-muted-foreground">
            The database isn&apos;t reachable. Set a reachable{" "}
            <code>DATABASE_URL</code> and apply migrations to see analytics.
          </p>
        </div>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Profit, volume and supplier performance across all imports."
      />

      <div className="space-y-6 p-6">
        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KPICard
            label="Total Containers"
            value={k.totalContainers.toLocaleString("en-IN")}
            icon={Package}
            accent="border-t-primary"
          />
          <KPICard
            label="Total Invoice Value"
            value={formatINR(k.totalInvoiceValueInr)}
            hint="BE invoice value (INR)"
            icon={Receipt}
            accent="border-t-primary"
          />
          <KPICard
            label="Total Profit"
            value={formatINR(k.totalProfit)}
            icon={TrendingUp}
            accent={k.totalProfit < 0 ? "border-t-danger" : "border-t-success"}
            valueClass={k.totalProfit < 0 ? "text-danger" : "text-success"}
          />
          <KPICard
            label="Avg Margin"
            value={k.avgMargin != null ? `${k.avgMargin.toFixed(1)}%` : "—"}
            icon={Percent}
            accent="border-t-warning"
            valueClass={marginColor(k.avgMargin)}
          />
          <KPICard
            label="Pending Documents"
            value={k.pendingDocs.toLocaleString("en-IN")}
            hint="Awaiting verification"
            icon={FileWarning}
            accent="border-t-warning"
          />
          {data.paymentOutstandingByCurrency.map((row) => (
            <KPICard
              key={row.currency}
              label={`Outstanding (${row.currency})`}
              value={formatMoney(row.amount, row.currency)}
              hint={`${row.count} open payment${row.count === 1 ? "" : "s"}`}
              icon={CreditCard}
              accent="border-t-danger"
              valueClass={row.amount > 0 ? "text-danger" : "text-muted-foreground"}
            />
          ))}
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="mb-4">
              <p className="label-caps">Executive Analytics</p>
              <h3 className="font-heading text-lg font-semibold">
                Decision metrics
              </h3>
              <p className="text-sm text-muted-foreground">
                Operational leakage and timing indicators that management can act on.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <KPICard
                label="Detention Leakage"
                value={formatINR(k.detentionChargesInr)}
                hint="Recorded detention charges"
                icon={AlertTriangle}
                accent="border-t-danger"
                valueClass={k.detentionChargesInr > 0 ? "text-danger" : "text-success"}
              />
              <KPICard
                label="ETA Variance"
                value={
                  k.avgEtaVarianceDays == null
                    ? "—"
                    : `${k.avgEtaVarianceDays.toFixed(1)}d`
                }
                hint="ATA vs original ETA"
                icon={Ship}
                accent="border-t-primary"
              />
              <KPICard
                label="Customs Cycle"
                value={
                  k.avgCustomsDays == null ? "—" : `${k.avgCustomsDays.toFixed(1)}d`
                }
                hint="ATA to Bill of Entry date"
                icon={Clock}
                accent="border-t-warning"
              />
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <AnalyticsCharts data={data} />

        {/* Top / Bottom tables */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ProfitTable title="Top 5 Profitable Containers" rows={data.top5} />
          <ProfitTable
            title="Bottom 5 / Loss-Making"
            rows={data.bottom5}
          />
        </div>

        {/* Supplier summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Containers</TableHead>
                  <TableHead className="text-right">Total Profit</TableHead>
                  <TableHead className="text-right">Avg Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.supplierSummary.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      <EmptyState
                        icon={DatabaseZap}
                        title="No supplier analytics yet"
                        description="Supplier performance appears after containers have approved sales and landed-cost data."
                        className="border-0 bg-transparent py-6"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  data.supplierSummary.map((s) => (
                    <TableRow key={s.supplier}>
                      <TableCell className="font-medium">{s.supplier}</TableCell>
                      <TableCell className="font-financial text-right">
                        {s.containers}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-financial text-right",
                          s.profit < 0 ? "text-danger" : "text-success"
                        )}
                      >
                        {formatINR(s.profit)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-financial text-right",
                          marginColor(s.avgMargin)
                        )}
                      >
                        {s.avgMargin != null ? `${s.avgMargin.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfitTable({
  title,
  rows,
}: {
  title: string;
  rows: Analytics["top5"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Container</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  <EmptyState
                    icon={BarChart3}
                    title="No ranked containers yet"
                    description="This ranking appears once containers have approved sales and profit calculations."
                    className="border-0 bg-transparent py-6"
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.containerNo}>
                  <TableCell className="font-financial font-medium">
                    {r.containerNo}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.supplier ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-financial text-right",
                      r.profit < 0 ? "text-danger" : "text-success"
                    )}
                  >
                    {formatINR(r.profit)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-financial text-right",
                      marginColor(r.marginPct)
                    )}
                  >
                    {r.marginPct != null ? `${r.marginPct.toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
