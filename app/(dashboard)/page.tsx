import Link from "next/link";
import {
  Package,
  FileWarning,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Percent,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAnalytics, type Analytics } from "@/lib/data/analytics";
import { cn, formatINR, formatUSD, marginColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await requireSession();
  const showFinancials = can(session.role, "financials.view");

  let data: Analytics | null = null;
  let loadError = false;
  try {
    data = await getAnalytics(session.orgId);
  } catch {
    loadError = true;
  }

  const k = data?.kpis;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of imports, costs, documentation and profit."
        actions={
          <Button asChild>
            <Link href="/containers">
              View Containers <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {loadError ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-muted-foreground">
            Couldn&apos;t load dashboard data — the database isn&apos;t reachable.
            Set a working <code>DATABASE_URL</code>.
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                label="Active Containers"
                value={(k?.totalContainers ?? 0).toLocaleString("en-IN")}
                hint="Total tracked"
                icon={Package}
                accent="border-t-primary"
              />
              {showFinancials ? (
                <Kpi
                  label="Total Profit"
                  value={formatINR(k?.totalProfit ?? 0)}
                  hint="Net of damages & cost"
                  icon={(k?.totalProfit ?? 0) >= 0 ? TrendingUp : TrendingDown}
                  accent={
                    (k?.totalProfit ?? 0) >= 0
                      ? "border-t-success"
                      : "border-t-danger"
                  }
                  tone={
                    (k?.totalProfit ?? 0) >= 0 ? "text-success" : "text-danger"
                  }
                />
              ) : (
                <Kpi
                  label="Invoice Value"
                  value="—"
                  hint="Restricted"
                  icon={Percent}
                  accent="border-t-primary"
                />
              )}
              {showFinancials && (
                <Kpi
                  label="Avg Margin"
                  value={k?.avgMargin != null ? `${k.avgMargin.toFixed(1)}%` : "—"}
                  hint="Across sold containers"
                  icon={Percent}
                  accent="border-t-warning"
                  tone={marginColor(k?.avgMargin)}
                />
              )}
              <Kpi
                label="Pending Documents"
                value={(k?.pendingDocs ?? 0).toLocaleString("en-IN")}
                hint="Expiring within 30 days"
                icon={FileWarning}
                accent="border-t-warning"
              />
              {showFinancials && (
                <Kpi
                  label="Outstanding Payments"
                  value={formatUSD(k?.outstandingUsd ?? 0)}
                  hint="Awaiting settlement"
                  icon={CreditCard}
                  accent="border-t-danger"
                  tone="text-danger"
                />
              )}
            </div>

            {/* Top / bottom containers */}
            {showFinancials && (
              <div className="grid gap-6 lg:grid-cols-2">
                <RankCard title="Top 5 Profitable" rows={data?.top5 ?? []} />
                <RankCard
                  title="Bottom 5 / Loss-Making"
                  rows={data?.bottom5 ?? []}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/containers">Containers</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/shipments">Shipments</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/alerts">Alerts</Link>
              </Button>
              {showFinancials && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/analytics">Analytics</Link>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Package;
  accent: string;
  tone?: string;
}) {
  return (
    <Card className={`border-t-4 ${accent}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("font-financial mt-2 text-3xl font-bold", tone)}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-md bg-surface-alt p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankCard({
  title,
  rows,
}: {
  title: string;
  rows: { containerNo: string; supplier: string | null; profit: number; marginPct: number | null }[];
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-3 font-heading text-base font-semibold">{title}</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.containerNo}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <Link
                    href={`/containers?q=${encodeURIComponent(r.containerNo)}`}
                    className="font-financial text-sm font-medium hover:text-primary"
                  >
                    {r.containerNo}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.supplier ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "font-financial text-sm font-medium",
                      r.profit >= 0 ? "text-success" : "text-danger"
                    )}
                  >
                    {formatINR(r.profit)}
                  </p>
                  {r.marginPct != null && (
                    <p className={cn("font-financial text-xs", marginColor(r.marginPct))}>
                      {r.marginPct.toFixed(1)}%
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
