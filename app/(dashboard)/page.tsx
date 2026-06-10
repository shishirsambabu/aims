import Link from "next/link";
import {
  Package,
  FileWarning,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Percent,
  BellRing,
  ShieldAlert,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { AlertActions } from "@/components/alerts/AlertActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAnalytics, type Analytics } from "@/lib/data/analytics";
import { getPersonalAlerts, type PersonalAlertSummary } from "@/lib/data/notifications";
import { cn, formatINR, formatUSD, marginColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await requireSession();
  const showFinancials = can(session.role, "financials.view");

  let data: Analytics | null = null;
  let workbench: PersonalAlertSummary | null = null;
  let loadError = false;
  try {
    [data, workbench] = await Promise.all([
      getAnalytics(session.orgId),
      getPersonalAlerts(session),
    ]);
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
            <Workbench data={workbench} role={session.role} />

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

function Workbench({
  data,
  role,
}: {
  data: PersonalAlertSummary | null;
  role: string;
}) {
  const active = data?.active ?? [];
  const topAlerts = active.slice(0, 5);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-surface via-surface to-primary/5">
        <CardContent className="p-0">
          <div className="border-b border-border px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label-caps">Operations Workbench</p>
                <h2 className="mt-1 font-heading text-2xl font-bold">
                  My work today
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Role-aware next actions for your {role.replace("_", " ")} queue.
                </p>
              </div>
              <div className="flex gap-2">
                <BadgeStat label="Unread" value={data?.unreadCount ?? 0} />
                <BadgeStat label="Critical" value={data?.criticalCount ?? 0} tone="danger" />
              </div>
            </div>
          </div>

          {topAlerts.length === 0 ? (
            <div className="flex items-center gap-3 px-6 py-8">
              <div className="rounded-full bg-success/10 p-3 text-success">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">No active tasks in your queue.</p>
                <p className="text-sm text-muted-foreground">
                  The noisy stuff stays out until the SOP actually needs you.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {topAlerts.map((a) => (
                <li key={a.id} className="px-6 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Link href={a.href} className="group flex min-w-0 gap-3">
                      <span
                        className={cn(
                          "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                          a.severity === "critical" ? "bg-danger" : "bg-warning"
                        )}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium group-hover:text-primary">
                            {a.title}
                          </p>
                          {a.isUnread && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {a.subtitle}
                        </p>
                        <p className="mt-1 text-xs font-medium text-primary">
                          Next: {a.primaryAction}
                        </p>
                      </div>
                    </Link>
                    <AlertActions alertKey={a.id} category={a.category} compact />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-warning/30 bg-warning/10">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#9A6212]" />
            <h3 className="font-heading text-base font-semibold">
              Detention watch
            </h3>
          </div>
          <p className="font-financial text-4xl font-bold">
            {data?.detentionCount ?? 0}
          </p>
          <p className="text-sm text-muted-foreground">
            Active containers are inside the free-day danger window or already
            accruing charges.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/alerts">Open alert center</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BadgeStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface px-3 py-2 text-right shadow-sm",
        tone === "danger" && "border-danger/25 bg-danger/5"
      )}
    >
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          "font-financial text-xl font-bold",
          tone === "danger" && "text-danger"
        )}
      >
        {value}
      </p>
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
    <Card
      className={cn(
        "group relative overflow-hidden border-t-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        accent
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-80" />
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-caps">{label}</p>
            <p className={cn("font-financial mt-2 text-3xl font-bold", tone)}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary ring-1 ring-primary/15">
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
