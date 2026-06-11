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
  Clock3,
  ClipboardCheck,
  Warehouse,
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
        title="Operations Command"
        description="A live cockpit for containers, documents, payments and SOP exceptions."
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
            <DashboardHero
              activeContainers={k?.totalContainers ?? 0}
              pendingDocs={k?.pendingDocs ?? 0}
              detentionCount={workbench?.detentionCount ?? 0}
              outstandingUsd={showFinancials ? (k?.outstandingUsd ?? 0) : null}
            />
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

            <div className="sticky bottom-4 z-10 flex flex-wrap gap-2 rounded-2xl border border-border/80 bg-background/85 p-2 shadow-card backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
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
      <Card className="command-surface overflow-hidden rounded-[1.5rem]">
        <CardContent className="p-0">
          <div className="border-b border-border/70 px-6 py-5">
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

      <Card className="lift-card overflow-hidden rounded-[1.5rem] border-warning/30 bg-gradient-to-br from-warning/15 via-card to-card">
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

function DashboardHero({
  activeContainers,
  pendingDocs,
  detentionCount,
  outstandingUsd,
}: {
  activeContainers: number;
  pendingDocs: number;
  detentionCount: number;
  outstandingUsd: number | null;
}) {
  const pulseItems = [
    {
      label: "Containers live",
      value: activeContainers.toLocaleString("en-IN"),
      icon: Warehouse,
    },
    {
      label: "Docs need eyes",
      value: pendingDocs.toLocaleString("en-IN"),
      icon: ClipboardCheck,
    },
    {
      label: "Detention watch",
      value: detentionCount.toLocaleString("en-IN"),
      icon: Clock3,
    },
  ];

  return (
    <section className="mesh-panel fade-in-up overflow-hidden rounded-[2rem] p-6 text-white shadow-card md:p-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">
            AIMS live desk
          </div>
          <h2 className="mt-5 max-w-3xl font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Move every import from port risk to warehouse clarity.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-sky-100/80 md:text-base">
            A task-first view for Aeden Imports Management System: what is late,
            what needs approval, and where money or documents are blocking flow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-slate-950 hover:bg-sky-50">
              <Link href="/containers">Open operations board</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              <Link href="/alerts">Review exceptions</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {pulseItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-2xl border border-white/[0.12] bg-white/10 p-4 shadow-2xl shadow-black/10 backdrop-blur"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-100/70">
                      {item.label}
                    </p>
                    <p className="font-financial mt-1 text-3xl font-bold">
                      {item.value}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.12] p-3 text-sky-100">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
          {outstandingUsd != null && (
            <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 p-4 text-amber-50">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/70">
                Outstanding AP
              </p>
              <p className="font-financial mt-1 text-2xl font-bold">
                {formatUSD(outstandingUsd)}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
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
        "group lift-card relative overflow-hidden rounded-[1.35rem] border-t-4",
        accent
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-90" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-surface-alt/55 to-transparent opacity-70" />
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-caps">{label}</p>
            <p className={cn("font-financial mt-2 text-3xl font-bold", tone)}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary ring-1 ring-primary/15">
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
    <Card className="lift-card overflow-hidden rounded-[1.5rem]">
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
