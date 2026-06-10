import Link from "next/link";
import { AlertTriangle, Lock } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn, formatINR, marginColor } from "@/lib/utils";

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
        <div className="m-6 flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> You don&apos;t have access to financial
          reports.
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
        description="Profit by supplier and port, AR/AP aging, and printable per-container P&L."
      />
      <div className="space-y-6 p-6">
        <ReportFilters />

        {loadError || !data ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <p className="text-muted-foreground">
              The database isn&apos;t reachable. Set a working{" "}
              <code>DATABASE_URL</code> and apply migrations.
            </p>
          </div>
        ) : (
          <>
            <ExportCenter from={params.from} to={params.to} />

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Containers" value={data.summary.containers.toString()} />
              <Kpi
                label="Invoice Value"
                value={formatINR(data.summary.invoiceValueInr)}
              />
              <Kpi
                label="Total Profit"
                value={formatINR(data.summary.profit)}
                tone={data.summary.profit >= 0 ? "text-success" : "text-danger"}
              />
              <Kpi
                label="Outstanding (AP)"
                value={formatINR(data.summary.outstanding)}
                tone="text-danger"
              />
            </div>

            {/* Supplier performance */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-3 font-heading text-base font-semibold">
                  Profit by Supplier
                </h3>
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
                          No data in range.
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
                          <TableCell className={cn("font-financial text-right", marginColor(s.marginPct))}>{s.marginPct != null ? `${s.marginPct.toFixed(1)}%` : "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Port breakdown */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-3 font-heading text-base font-semibold">
                    Profit by Port
                  </h3>
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

              {/* AR/AP aging */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-3 font-heading text-base font-semibold">
                    Payables Aging (AP)
                  </h3>
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
            </div>

            <p className="text-sm text-muted-foreground">
              Need a single-container statement? Open a container and use{" "}
              <Link href="/containers" className="text-primary hover:underline">
                Containers
              </Link>{" "}
              → its P&amp;L print view (link on each container).
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
        <p className={cn("font-financial mt-1 text-2xl font-bold", tone)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
