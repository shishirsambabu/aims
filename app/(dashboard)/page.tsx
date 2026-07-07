import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Package,
  Percent,
  Settings,
  ShieldAlert,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users2,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { AlertActions } from "@/components/alerts/AlertActions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAnalytics, type Analytics } from "@/lib/data/analytics";
import {
  getPersonalAlerts,
  type PersonalAlertSummary,
} from "@/lib/data/notifications";
import { cn, formatINR, formatMoney, marginColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MODULES = [
  {
    id: "import-docs",
    title: "Import Documentation",
    href: "/?module=import-docs",
    workspaceHref: "/containers",
    icon: FileText,
    status: "Live",
    description: "Container tracker, linked docs, status pipeline, and exceptions.",
    submodules: ["Containers", "Documents", "Shipments", "Payments"],
  },
  {
    id: "warehouse",
    title: "Warehouse",
    href: "/?module=warehouse",
    workspaceHref: "/warehouse",
    icon: Warehouse,
    status: "Live",
    description: "Stock receipt, FEFO lots, cycle counts, and dispatch control.",
    submodules: ["Receiving", "Grading", "Cycle counts", "Dispatch"],
  },
  {
    id: "procurement",
    title: "Procurement",
    href: "/?module=procurement",
    workspaceHref: "/procurement",
    icon: FileSpreadsheet,
    status: "Coming soon",
    description: "Supplier onboarding, purchase planning, and import sourcing.",
    submodules: ["Suppliers", "Purchase plans", "Approvals"],
  },
  {
    id: "sales",
    title: "Sales",
    href: "/?module=sales",
    workspaceHref: "/sales",
    icon: ShoppingCart,
    status: "Live",
    description: "Quotes, orders, approvals, amendments, and conversion flow.",
    submodules: ["Quotes", "Orders", "Price lists"],
  },
  {
    id: "crm",
    title: "CRM",
    href: "/?module=crm",
    workspaceHref: "/crm",
    icon: Users2,
    status: "Live",
    description: "Leads, opportunities, follow-ups, reminders, and customer control.",
    submodules: ["Pipeline", "Tasks", "Credit control"],
  },
  {
    id: "finance",
    title: "Finance",
    href: "/?module=finance",
    workspaceHref: "/finance",
    icon: CreditCard,
    status: "Live",
    description: "Receipts, payables, collections, and margin visibility.",
    submodules: ["Payments", "Receipts", "Outstanding"],
  },
  {
    id: "reports",
    title: "Reports",
    href: "/?module=reports",
    workspaceHref: "/reports",
    icon: BarChart3,
    status: "Live",
    description: "Operational, financial, and management reporting surfaces.",
    submodules: ["KPIs", "Exports", "Aging"],
  },
  {
    id: "settings",
    title: "Settings",
    href: "/?module=settings",
    workspaceHref: "/settings",
    icon: Settings,
    status: "Live",
    description: "Roles, permissions, defaults, workflows, and system config.",
    submodules: ["Users", "Roles", "Master data"],
  },
] as const;

type DashboardModuleId = (typeof MODULES)[number]["id"];

interface PageProps {
  searchParams: Promise<{ module?: string }>;
}

function normalizeDashboardModule(value: string | undefined): DashboardModuleId | null {
  return MODULES.some((module) => module.id === value) ? (value as DashboardModuleId) : null;
}

export default async function DashboardHome({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await requireSession();
  const showFinancials = can(session.role, "financials.view");
  const selectedModule = normalizeDashboardModule(params.module);

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
  const criticalCount = workbench?.criticalCount ?? 0;
  const detention = workbench?.detentionCount ?? 0;
  const apRows = data?.paymentOutstandingByCurrency ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Operational overview: exceptions, money, documents, and module workspaces."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/sop">SOP Center</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/alerts">
                Alerts
                {criticalCount > 0 && (
                  <span className="font-financial ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-semibold">
                    {criticalCount}
                  </span>
                )}
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-5 md:p-6">
        {loadError ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-muted-foreground">
            Couldn&apos;t load dashboard data. The database is not reachable from
            this environment. Set a working <code>DATABASE_URL</code> and retry.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Active Containers"
                value={(k?.totalContainers ?? 0).toLocaleString("en-IN")}
                hint="Total tracked"
                icon={Package}
              />
              {showFinancials ? (
                <Kpi
                  label="Total Profit"
                  value={formatINR(k?.totalProfit ?? 0)}
                  hint="Net of damages and cost"
                  icon={(k?.totalProfit ?? 0) >= 0 ? TrendingUp : TrendingDown}
                  tone={(k?.totalProfit ?? 0) >= 0 ? "text-success" : "text-danger"}
                />
              ) : (
                <Kpi
                  label="Financials"
                  value="Restricted"
                  hint="Hidden for this role"
                  icon={Percent}
                />
              )}
              {showFinancials && (
                <Kpi
                  label="Avg Margin"
                  value={typeof k?.avgMargin === "number" ? `${k.avgMargin.toFixed(1)}%` : "—"}
                  hint="Across sold containers"
                  icon={Percent}
                  tone={marginColor(k?.avgMargin ?? null)}
                />
              )}
              <Kpi
                label="Pending Documents"
                value={(k?.pendingDocs ?? 0).toLocaleString("en-IN")}
                hint="Completeness queue"
                icon={ClipboardCheck}
                tone={(k?.pendingDocs ?? 0) > 0 ? "text-warning" : undefined}
              />
              <Kpi
                label="Detention Watch"
                value={detention.toLocaleString("en-IN")}
                hint="Inside free-day danger window"
                icon={Clock3}
                tone={detention > 0 ? "text-danger" : "text-success"}
              />
              <Kpi
                label="Critical Alerts"
                value={criticalCount.toLocaleString("en-IN")}
                hint="Need action first"
                icon={ShieldAlert}
                tone={criticalCount > 0 ? "text-danger" : "text-success"}
              />
              {showFinancials &&
                apRows.map((row) => (
                  <Kpi
                    key={row.currency}
                    label={`Outstanding (${row.currency})`}
                    value={formatMoney(row.amount, row.currency)}
                    hint={`${row.count} open payment${row.count === 1 ? "" : "s"}`}
                    icon={CreditCard}
                    tone={row.amount > 0 ? "text-danger" : undefined}
                  />
                ))}
            </div>

            <Workbench data={workbench} role={session.role} />

            <ModuleDashboardTabs selectedModule={selectedModule} showFinancials={showFinancials} />

            {selectedModule ? (
              <ModuleDecisionDashboard
                moduleId={selectedModule}
                data={data}
                workbench={workbench}
                showFinancials={showFinancials}
              />
            ) : (
              <ModuleLauncher />
            )}

            {showFinancials && (
              <div className="grid gap-4 lg:grid-cols-2">
                <RankCard title="Top 5 Profitable" rows={data?.top5 ?? []} />
                <RankCard title="Bottom 5 / Loss-Making" rows={data?.bottom5 ?? []} />
              </div>
            )}
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
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="label-caps">{label}</p>
          <p className={cn("font-financial mt-1.5 truncate text-xl font-bold", tone)}>
            {value}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-md bg-accent p-2 text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleDashboardTabs({
  selectedModule,
  showFinancials,
}: {
  selectedModule: DashboardModuleId | null;
  showFinancials: boolean;
}) {
  const visibleModules = MODULES.filter(
    (module) => showFinancials || !["finance", "reports"].includes(module.id)
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
      <Button asChild variant={selectedModule ? "ghost" : "secondary"} size="sm">
        <Link href="/">Overview</Link>
      </Button>
      {visibleModules.map((module) => {
        const active = selectedModule === module.id;
        return (
          <Button
            key={module.id}
            asChild
            variant={active ? "secondary" : "ghost"}
            size="sm"
          >
            <Link href={module.href}>{module.title}</Link>
          </Button>
        );
      })}
    </div>
  );
}

function ModuleDecisionDashboard({
  moduleId,
  data,
  workbench,
  showFinancials,
}: {
  moduleId: DashboardModuleId;
  data: Analytics | null;
  workbench: PersonalAlertSummary | null;
  showFinancials: boolean;
}) {
  const selectedModuleConfig = MODULES.find((item) => item.id === moduleId) ?? MODULES[0];
  const Icon = selectedModuleConfig.icon;
  const activeAlerts = workbench?.active ?? [];
  const relevantAlerts = activeAlerts.filter((alert) => {
    if (moduleId === "import-docs") return ["arrival", "demurrage", "docExpiry", "flagged"].includes(alert.category);
    if (moduleId === "warehouse") return ["arrival", "demurrage", "docExpiry"].includes(alert.category);
    if (moduleId === "sales" || moduleId === "crm") return ["lossMaking", "flagged"].includes(alert.category);
    if (moduleId === "finance" || moduleId === "reports") return ["approval", "paymentOverdue", "lossMaking"].includes(alert.category);
    return alert.severity === "critical";
  });
  const apRows = data?.paymentOutstandingByCurrency ?? [];
  const apLabel =
    apRows
      .filter((row) => row.amount > 0)
      .map((row) => formatMoney(row.amount, row.currency))
      .join(" / ") || "Clear";
  const lossCount = (data?.bottom5 ?? []).filter((row) => row.profit < 0).length;
  const moduleMetrics = getModuleDashboardMetrics(moduleId, data, showFinancials, apLabel, lossCount);
  const actions = getModuleDashboardActions(moduleId, selectedModuleConfig.workspaceHref, showFinancials);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-md bg-accent p-2 text-accent-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-bold">
              {selectedModuleConfig.title}
            </h2>
            <p className="truncate text-[13px] text-muted-foreground">
              {getModuleDashboardDescription(moduleId)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {actions.slice(0, 2).map((action, index) => (
            <Button
              key={action.href}
              asChild
              size="sm"
              variant={index === 0 ? "default" : "outline"}
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
        {moduleMetrics.map((metric) => (
          <ModuleStat key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 border-t border-border p-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-heading text-sm font-semibold">
              Needs attention in this module
            </h3>
            <Button asChild variant="ghost" size="sm">
              <Link href="/alerts">Open alerts</Link>
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {relevantAlerts.length === 0 ? (
              <div className="rounded-md border border-border bg-surface-alt/50 p-3.5 text-[13px] text-muted-foreground">
                No active module-specific blockers are visible for your role.
              </div>
            ) : (
              relevantAlerts.slice(0, 5).map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href}
                  className="block rounded-md border border-border p-3.5 transition-colors hover:border-primary/40 hover:bg-accent/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{alert.subtitle}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase",
                        alert.severity === "critical"
                          ? "bg-danger/10 text-danger"
                          : "bg-warning/15 text-[#9A6212]"
                      )}
                    >
                      {alert.severity}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface-alt/40 p-4">
          <h3 className="font-heading text-sm font-semibold">Workspace shortcuts</h3>
          <div className="mt-3 grid gap-1.5">
            {actions.map((action) => (
              <Button key={action.href} asChild variant="outline" size="sm" className="justify-between">
                <Link href={action.href}>
                  {action.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ))}
            <Button asChild variant="ghost" size="sm" className="justify-between">
              <Link href="/sop">
                SOP Center
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function getModuleDashboardMetrics(
  moduleId: DashboardModuleId,
  data: Analytics | null,
  showFinancials: boolean,
  apLabel: string,
  lossCount: number
) {
  const k = data?.kpis;
  const restricted = showFinancials ? null : "Restricted";
  const supplierCount = data?.supplierSummary.length ?? 0;
  const portCount = data?.containersByPort.length ?? 0;
  const profitValue = showFinancials ? formatINR(k?.totalProfit ?? 0) : restricted;
  const marginValue = showFinancials && k?.avgMargin != null ? `${k.avgMargin.toFixed(1)}%` : restricted;

  if (moduleId === "warehouse") {
    return [
      { label: "Containers in flow", value: (k?.totalContainers ?? 0).toLocaleString("en-IN"), hint: "Import stock pipeline", tone: undefined },
      { label: "Doc blockers", value: (k?.pendingDocs ?? 0).toLocaleString("en-IN"), hint: "Can delay receiving", tone: (k?.pendingDocs ?? 0) > 0 ? "text-warning" : "text-success" },
      { label: "Avg customs days", value: k?.avgCustomsDays != null ? `${k.avgCustomsDays}d` : "No data", hint: "Port to BE readiness", tone: undefined },
      { label: "Detention charges", value: showFinancials ? formatINR(k?.detentionChargesInr ?? 0) : "Restricted", hint: "Cold-chain/cash leakage", tone: (k?.detentionChargesInr ?? 0) > 0 ? "text-danger" : "text-success" },
    ];
  }

  if (moduleId === "sales") {
    return [
      { label: "Avg margin", value: marginValue ?? "No data", hint: "Approved order performance", tone: showFinancials ? marginColor(k?.avgMargin ?? null) : undefined },
      { label: "Loss rows", value: lossCount.toString(), hint: "Containers needing price review", tone: lossCount > 0 ? "text-danger" : "text-success" },
      { label: "Profit", value: profitValue ?? "No data", hint: "Approved container result", tone: showFinancials && (k?.totalProfit ?? 0) < 0 ? "text-danger" : "text-success" },
      { label: "Day-price exposure", value: (k?.totalContainers ?? 0).toLocaleString("en-IN"), hint: "Use sales workspace for price rows", tone: undefined },
    ];
  }

  if (moduleId === "crm") {
    return [
      { label: "Customer risk", value: showFinancials ? apLabel : "Role limited", hint: "Credit/collection context", tone: showFinancials && apLabel !== "Clear" ? "text-warning" : "text-success" },
      { label: "Loss-linked accounts", value: lossCount.toString(), hint: "Review selling discipline", tone: lossCount > 0 ? "text-danger" : "text-success" },
      { label: "Open docs impact", value: (k?.pendingDocs ?? 0).toString(), hint: "May affect customer delivery", tone: (k?.pendingDocs ?? 0) > 0 ? "text-warning" : "text-success" },
      { label: "Active containers", value: (k?.totalContainers ?? 0).toString(), hint: "Potential order supply", tone: undefined },
    ];
  }

  if (moduleId === "finance") {
    return [
      { label: "AP exposure", value: showFinancials ? apLabel : "Restricted", hint: "Supplier/payment pressure", tone: showFinancials && apLabel !== "Clear" ? "text-danger" : "text-success" },
      { label: "Profit", value: profitValue ?? "No data", hint: "Approved result", tone: showFinancials && (k?.totalProfit ?? 0) < 0 ? "text-danger" : "text-success" },
      { label: "Detention", value: showFinancials ? formatINR(k?.detentionChargesInr ?? 0) : "Restricted", hint: "Operational leakage", tone: (k?.detentionChargesInr ?? 0) > 0 ? "text-warning" : "text-success" },
      { label: "Collections", value: "Ledger", hint: "Open receipts dashboard", tone: undefined },
    ];
  }

  if (moduleId === "reports") {
    return [
      { label: "Suppliers", value: supplierCount.toString(), hint: "Reportable supplier rows", tone: undefined },
      { label: "Ports", value: portCount.toString(), hint: "Import route split", tone: undefined },
      { label: "Profit trend", value: `${data?.profitTrend.length ?? 0} months`, hint: "Management pack basis", tone: undefined },
      { label: "Export center", value: "PDF/XLSX", hint: "Management report formats", tone: undefined },
    ];
  }

  if (moduleId === "import-docs") {
    return [
      { label: "Containers", value: (k?.totalContainers ?? 0).toLocaleString("en-IN"), hint: "Live import trail", tone: undefined },
      { label: "Pending docs", value: (k?.pendingDocs ?? 0).toLocaleString("en-IN"), hint: "Completeness queue", tone: (k?.pendingDocs ?? 0) > 0 ? "text-warning" : "text-success" },
      { label: "ETA variance", value: k?.avgEtaVarianceDays != null ? `${k.avgEtaVarianceDays}d` : "No data", hint: "Schedule discipline", tone: undefined },
      { label: "Customs speed", value: k?.avgCustomsDays != null ? `${k.avgCustomsDays}d` : "No data", hint: "Port clearance cycle", tone: undefined },
    ];
  }

  return [
    { label: "Status", value: moduleId === "procurement" ? "Planning" : "Live", hint: "Module readiness", tone: undefined },
    { label: "Controls", value: "Configured", hint: "Role and workflow checks", tone: "text-success" },
    { label: "SOPs", value: "Linked", hint: "Use SOP Center for process", tone: undefined },
    { label: "Next build", value: "Queued", hint: "Master roadmap controlled", tone: undefined },
  ];
}

function getModuleDashboardActions(moduleId: DashboardModuleId, workspaceHref: string, showFinancials: boolean) {
  if (moduleId === "warehouse") {
    return [
      { label: "Open warehouse workspace", href: workspaceHref },
      { label: "Inward", href: "/warehouse" },
      { label: "Grading / packing", href: "/warehouse?tab=processing" },
      { label: "Outward", href: "/warehouse?tab=outward" },
    ];
  }
  if (moduleId === "sales") {
    return [
      { label: "Open sales dashboard", href: workspaceHref },
      { label: "Day price and orders", href: "/orders" },
      { label: "Quotes", href: "/quotes" },
    ];
  }
  if (moduleId === "crm") {
    return [
      { label: "Open CRM pipeline", href: workspaceHref },
      { label: "Customer master", href: "/customers" },
      { label: "Collections ledger", href: "/receipts" },
    ];
  }
  if (moduleId === "finance") {
    return [
      { label: "Open finance controls", href: workspaceHref },
      { label: "Receipts ledger", href: "/receipts" },
      { label: "Reports", href: showFinancials ? "/reports" : "/finance" },
    ];
  }
  if (moduleId === "reports") {
    return [
      { label: "Open management reports", href: workspaceHref },
      { label: "Analytics", href: "/analytics" },
      { label: "Export center", href: "/reports/exports" },
    ];
  }
  if (moduleId === "import-docs") {
    return [
      { label: "Open containers", href: workspaceHref },
      { label: "Documents", href: "/documents" },
      { label: "Shipments", href: "/shipments" },
    ];
  }
  return [
    { label: "Open workspace", href: workspaceHref },
    { label: "Open SOP Center", href: "/sop" },
  ];
}

function getModuleDashboardDescription(moduleId: DashboardModuleId) {
  if (moduleId === "warehouse") {
    return "Receiving, document blockers, detention risk, stock, cycle count, and dispatch.";
  }
  if (moduleId === "sales") {
    return "Day-price discipline, margin leakage, quote conversion, and customer credit pressure.";
  }
  if (moduleId === "crm") {
    return "Customer onboarding, follow-ups, and credit/collections review.";
  }
  if (moduleId === "finance") {
    return "Cash exposure, receipts, payables, journals, and close readiness.";
  }
  if (moduleId === "reports") {
    return "Management pack exports and report drill-downs.";
  }
  if (moduleId === "import-docs") {
    return "Containers and BLs through documentation, clearance, and shipment checkpoints.";
  }
  if (moduleId === "procurement") {
    return "Supplier planning, purchase approvals, import sourcing, and negotiated terms.";
  }
  return "Roles, permissions, integrations, master data, and workflow configuration.";
}

function ModuleStat({
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
    <div className="rounded-md border border-border bg-surface-alt/40 p-3.5">
      <p className="label-caps">{label}</p>
      <p className={cn("font-financial mt-1.5 text-lg font-bold", tone)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ModuleLauncher() {
  return (
    <section className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((module) => {
          const Icon = module.icon;
          const comingSoon = module.status.toLowerCase().includes("coming");

          return (
            <Link
              key={module.title}
              href={module.href}
              className={cn(
                "group rounded-lg border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover",
                comingSoon && "opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-md bg-accent p-2 text-accent-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-medium",
                    comingSoon
                      ? "bg-muted text-muted-foreground"
                      : "bg-success-light text-success"
                  )}
                >
                  {module.status}
                </span>
              </div>

              <h3 className="mt-3 font-heading text-sm font-bold group-hover:text-primary">
                {module.title}
              </h3>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {module.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-1">
                {module.submodules.map((item) => (
                  <span
                    key={item}
                    className="rounded bg-surface-alt px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
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
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-4">
        <div>
          <CardTitle>My work today</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Role-aware next actions for your {role.replace("_", " ")} queue.
          </p>
        </div>
        <div className="flex gap-2">
          <BadgeStat label="Unread" value={data?.unreadCount ?? 0} />
          <BadgeStat label="Critical" value={data?.criticalCount ?? 0} tone="danger" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {topAlerts.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-6">
            <div className="rounded-full bg-success/10 p-2.5 text-success">
              <BellRing className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">No active tasks in your queue.</p>
              <p className="text-[13px] text-muted-foreground">
                Alerts appear here when the workflow needs you.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {topAlerts.map((a) => (
              <li key={a.id} className="px-5 py-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <Link href={a.href} className="group flex min-w-0 gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        a.severity === "critical" ? "bg-danger" : "bg-warning"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium group-hover:text-primary">
                          {a.title}
                        </p>
                        {a.isUnread && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-muted-foreground">{a.subtitle}</p>
                      <p className="mt-0.5 text-xs font-medium text-primary">
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
        "rounded-md border border-border bg-surface px-2.5 py-1.5 text-right",
        tone === "danger" && value > 0 && "border-danger/25 bg-danger/5"
      )}
    >
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          "font-financial text-base font-bold",
          tone === "danger" && value > 0 && "text-danger"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RankCard({
  title,
  rows,
}: {
  title: string;
  rows: {
    containerNo: string;
    supplier: string | null;
    profit: number;
    marginPct: number | null;
  }[];
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {rows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No ranked containers yet"
            description="Rankings appear once containers have approved sales and profit calculations."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.containerNo}
                className="flex items-center justify-between py-2"
              >
                <div className="min-w-0">
                  <Link
                    href={`/containers?q=${encodeURIComponent(r.containerNo)}`}
                    className="font-financial text-sm font-medium hover:text-primary"
                  >
                    {r.containerNo}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.supplier ?? "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
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
