import Link from "next/link";
import { AlertTriangle, BarChart3, Lock, WifiOff } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportCenter } from "@/components/reports/ExportCenter";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getReportData, type ReportData } from "@/lib/data/reports";
import { cn, formatDate, formatINR, marginColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await requireSession();

  if (!can(session.role, "financials.view")) {
    return (
      <div>
        <PageHeader title="Reports" description="Financial reporting." />
        <div className="p-6">
          <EmptyState
            icon={Lock}
            title="Financial reports are restricted"
            description="Only roles with financial visibility can access management reports and exports."
          />
        </div>
      </div>
    );
  }

  let data: ReportData | null = null;
  let loadError = false;
  try {
    data = await getReportData(session.orgId, {
      from: params.from,
      to: params.to,
    });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Profit by supplier and port, AP/AR aging, customer collections, and printable management packs."
      />
      <div className="space-y-6 p-6">
        <ReportFilters />

        {loadError || !data ? (
          <EmptyState
            icon={WifiOff}
            title="Reports could not load"
            description="The database is not reachable. Set a working DATABASE_URL and apply migrations."
          />
        ) : (
          <>
            <ExportCenter from={params.from} to={params.to} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Containers" value={data.summary.containers.toString()} />
              <Kpi label="Invoice Value" value={formatINR(data.summary.invoiceValueInr)} />
              <Kpi
                label="Total Profit"
                value={formatINR(data.summary.profit)}
                tone={data.summary.profit >= 0 ? "text-success" : "text-danger"}
              />
              <Kpi label="Collections" value={formatINR(data.summary.receiptValue)} tone="text-success" />
              <Kpi label="Outstanding (AP)" value={formatINR(data.summary.outstanding)} tone="text-danger" />
              <Kpi label="Outstanding (AR)" value={formatINR(data.summary.arOutstanding)} tone="text-warning" />
              <Kpi label="AR Overdue" value={formatINR(data.summary.arOverdue)} tone={data.summary.arOverdue > 0 ? "text-danger" : "text-success"} />
              <Kpi label="Recent Receipts" value={data.summary.receiptCount.toString()} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Open Customers" value={data.receivables.length.toString()} />
              <Kpi label="AP Aging Buckets" value={data.aging.length.toString()} />
              <Kpi label="AR Aging Buckets" value={data.receivablesAging.length.toString()} />
              <Kpi
                label="Net Cash Gap"
                value={formatINR(data.summary.arOutstanding - data.summary.outstanding)}
                tone={data.summary.arOutstanding - data.summary.outstanding >= 0 ? "text-warning" : "text-success"}
              />
            </div>

            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-3 font-heading text-base font-semibold">Profit by Supplier</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Containers</TableHead>
                      <TableHead className="text-right">Invoice (INR)</TableHead>
                      <TableHead className="text-right">Sale Value</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.suppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                          <EmptyState
                            icon={BarChart3}
                            title="No report data in this range"
                            description="Try widening the date range or confirm containers have approved sales and cost data."
                            className="border-0 bg-transparent py-6"
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.suppliers.map((s) => (
                        <TableRow key={s.supplier}>
                          <TableCell className="font-medium">{s.supplier}</TableCell>
                          <TableCell className="font-financial text-right">{s.containers}</TableCell>
                          <TableCell className="font-financial text-right">{formatINR(s.invoiceValueInr)}</TableCell>
                          <TableCell className="font-financial text-right">{formatINR(s.saleValue)}</TableCell>
                          <TableCell className={cn("font-financial text-right", s.profit >= 0 ? "text-success" : "text-danger")}>{formatINR(s.profit)}</TableCell>
                          <TableCell className={cn("font-financial text-right", marginColor(s.marginPct))}>{s.marginPct != null ? `${s.marginPct.toFixed(1)}%` : "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-3 font-heading text-base font-semibold">Profit by Port</h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Port</TableHead>
                        <TableHead className="text-right">Containers</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ports.map((p) => (
                        <TableRow key={p.port}>
                          <TableCell>{p.port}</TableCell>
                          <TableCell className="font-financial text-right">{p.containers}</TableCell>
                          <TableCell className={cn("font-financial text-right", p.profit >= 0 ? "text-success" : "text-danger")}>{formatINR(p.profit)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-3 font-heading text-base font-semibold">Payables Aging (AP)</h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.aging.map((b) => (
                        <TableRow key={b.label}>
                          <TableCell>{b.label}</TableCell>
                          <TableCell className="font-financial text-right">{b.count}</TableCell>
                          <TableCell className="font-financial text-right">{formatINR(b.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-3 font-heading text-base font-semibold">Receivables Aging (AR)</h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.receivablesAging.map((b) => (
                        <TableRow key={b.label}>
                          <TableCell>{b.label}</TableCell>
                          <TableCell className="font-financial text-right">{b.count}</TableCell>
                          <TableCell className="font-financial text-right">{formatINR(b.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-3 font-heading text-base font-semibold">Recent Receipts</h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Receipt</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentReceipts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                            <EmptyState
                              icon={AlertTriangle}
                              title="No receipts recorded"
                              description="Recorded collections will appear here immediately after finance posts them."
                              className="border-0 bg-transparent py-6"
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.recentReceipts.map((r) => (
                          <TableRow key={r.receiptNo}>
                            <TableCell className="font-financial">{r.receiptNo}</TableCell>
                            <TableCell>{r.customerName}</TableCell>
                            <TableCell>{formatDate(r.receiptDate)}</TableCell>
                            <TableCell>{r.method}</TableCell>
                            <TableCell className="font-financial text-right">{formatINR(r.amount)}</TableCell>
                            <TableCell>{r.status}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-3 font-heading text-base font-semibold">Top Customer Receivables</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Customer</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead>Oldest Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.receivables.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                          <EmptyState
                            icon={Lock}
                            title="No customer receivables yet"
                            description="Collections will appear here after approved sales orders are recorded and matched."
                            className="border-0 bg-transparent py-6"
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.receivables.slice(0, 10).map((row) => (
                        <TableRow key={row.customerId}>
                          <TableCell className="font-medium">{row.customerCode} - {row.customerName}</TableCell>
                          <TableCell>{row.region ?? "-"}</TableCell>
                          <TableCell className="font-financial text-right">{formatINR(row.outstanding)}</TableCell>
                          <TableCell className={cn("font-financial text-right", row.overdue > 0 ? "text-danger" : "text-success")}>{formatINR(row.overdue)}</TableCell>
                          <TableCell>{row.oldestDueDate ? formatDate(row.oldestDueDate) : "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
              Need a single-container statement? Open a container and use{" "}
              <Link href="/containers" className="text-primary hover:underline">
                Containers
              </Link>{" "}
              {"->"} its P&amp;L print view (link on each container).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("font-financial mt-1 text-2xl font-bold", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}
