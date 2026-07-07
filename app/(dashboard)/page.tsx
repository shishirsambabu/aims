import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Clock3,
  ClipboardCheck,
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
} from "lucide-react";

import { AlertActions } from "@/components/alerts/AlertActions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth";
import { BRAND_SHORT_NAME } from "@/lib/branding";
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
    submodules: ["Container tracker", "Document manager", "Shipments", "Payments"],
    tone: "from-sky-500/25 to-blue-500/10",
  },
  {
    id: "warehouse",
    title: "Warehouse",
    href: "/?module=warehouse",
    workspaceHref: "/warehouse",
    icon: Warehouse,
    status: "Live",
    description: "Stock receipt, FEFO lots, cycle counts, and dispatch control.",
    submodules: ["Receiving", "Grading", "Cycle counts", "Dispatch queue"],
    tone: "from-emerald-500/20 to-teal-500/10",
  },
  {
    id: "procurement",
    title: "Procurement",
    href: "/?module=procurement",
    workspaceHref: "/procurement",
    icon: FileSpreadsheet,
    status: "Coming soon",
    description: "Supplier onboarding, purchase planning, and import sourcing.",
    submodules: ["Suppliers", "Purchase plans", "Negotiation", "Approvals"],
    tone: "from-slate-500/20 to-slate-400/10",
  },
  {
    id: "sales",
    title: "Sales",
    href: "/?module=sales",
    workspaceHref: "/sales",
    icon: ShoppingCart,
    status: "Live",
    description: "Quotes, orders, approvals, amendments, and conversion flow.",
    submodules: ["Quotes", "Orders", "Price lists", "Forecast view"],
    tone: "from-amber-500/20 to-orange-500/10",
  },
  {
    id: "crm",
    title: "CRM",
    href: "/?module=crm",
    workspaceHref: "/crm",
    icon: Users2,
    status: "Live",
    description: "Leads, opportunities, follow-ups, reminders, and customer control.",
    submodules: ["Pipeline", "Tasks", "KYC", "Credit control"],
    tone: "from-fuchsia-500/20 to-pink-500/10",
  },
  {
    id: "finance",
    title: "Finance",
    href: "/?module=finance",
    workspaceHref: "/finance",
    icon: CreditCard,
    status: "Live",
    description: "Receipts, payables, collections, and margin visibility.",
    submodules: ["Payments", "Receipts", "Outstanding", "Profit views"],
    tone: "from-lime-500/20 to-green-500/10",
  },
  {
    id: "reports",
    title: "Reports",
    href: "/?module=reports",
    workspaceHref: "/reports",
    icon: BarChart3,
    status: "Live",
    description: "Operational, financial, and management reporting surfaces.",
    submodules: ["KPI cards", "Exports", "Aging", "Management pack"],
    tone: "from-cyan-500/20 to-sky-500/10",
  },
  {
    id: "settings",
    title: "Settings",
    href: "/?module=settings",
    workspaceHref: "/settings",
    icon: Settings,
    status: "Live",
    description: "Roles, permissions, defaults, workflows, and system config.",
    submodules: ["Users", "Roles", "Workflow rules", "Master data"],
    tone: "from-indigo-500/20 to-violet-500/10",
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

  return (
    <div>
      <PageHeader
        title={`${BRAND_SHORT_NAME} Command Cockpit`}
        description="Decision desk for imported-fruit operations: risk, money, documents, stock flow, and next actions before module navigation."
        actions={
          <Button asChild>
            <Link href="/sop">
              Open SOP center <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {loadError ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-muted-foreground">
            Couldn&apos;t load dashboard data. The database is not reachable from
            this environment. Set a working <code>DATABASE_URL</code> and retry.
          </div>
        ) : (
          <>
            <DecisionCockpit
              data={data}
              workbench={workbench}
              showFinancials={showFinancials}
            />

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

            {false && (
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
                  hint="Net of damages and cost"
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
                  value="Restricted"
                  hint="Financials hidden for this role"
                  icon={Percent}
                  accent="border-t-primary"
                />
              )}
              {showFinancials && (
                <Kpi
                  label="Avg Margin"
                  value={typeof k?.avgMargin === "number" ? `${(k?.avgMargin ?? 0).toFixed(1)}%` : "—"}
                  hint="Across sold containers"
                  icon={Percent}
                  accent="border-t-warning"
                  tone={marginColor(k?.avgMargin ?? null)}
                />
              )}
              <Kpi
                label="Pending Documents"
                value={(k?.pendingDocs ?? 0).toLocaleString("en-IN")}
                hint="Expiring within 30 days"
                icon={ClipboardCheck}
                accent="border-t-warning"
              />
              {showFinancials &&
                (data?.paymentOutstandingByCurrency ?? []).map((row) => (
                  <Kpi
                    key={row.currency}
                    label={`Outstanding (${row.currency})`}
                    value={formatMoney(row.amount, row.currency)}
                    hint={`${row.count} open payment${row.count === 1 ? "" : "s"}`}
                    icon={CreditCard}
                    accent="border-t-danger"
                    tone={row.amount > 0 ? "text-danger" : "text-muted-foreground"}
                  />
                ))}
            </div>
            )}

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
                <Link href="/?module=import-docs">Import Docs</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/?module=warehouse">Warehouse</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/?module=crm">CRM</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/?module=sales">Sales</Link>
              </Button>
              {showFinancials && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/?module=finance">Finance</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href="/?module=reports">Reports</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
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
    <section className="rounded-[1.5rem] border border-border bg-card p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant={selectedModule ? "ghost" : "default"} size="sm">
          <Link href="/">Overall dashboard</Link>
        </Button>
        {visibleModules.map((module) => {
          const Icon = module.icon;
          const active = selectedModule === module.id;
          return (
            <Button
              key={module.id}
              asChild
              variant={active ? "default" : "outline"}
              size="sm"
              className="justify-start"
            >
              <Link href={module.href}>
                <Icon className="h-4 w-4" />
                {module.title}
              </Link>
            </Button>
          );
        })}
      </div>
    </section>
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
  const k = data?.kpis;
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
    <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-card">
      <div className={cn("relative overflow-hidden bg-gradient-to-br p-6 text-white", selectedModuleConfig.tone)}>
        <div className="absolute inset-0 bg-slate-950/72" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              <Icon className="h-4 w-4" />
              {selectedModuleConfig.title} dashboard
            </div>
            <h2 className="mt-4 font-heading text-3xl font-bold">
              {getModuleDashboardTitle(moduleId)}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
              {getModuleDashboardDescription(moduleId)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.slice(0, 2).map((action, index) => (
              <Button
                key={action.href}
                asChild
                variant={index === 0 ? "secondary" : "outline"}
                className={cn(
                  index === 0
                    ? "bg-white text-slate-950 hover:bg-sky-50"
                    : "border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                )}
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        {moduleMetrics.map((metric) => (
          <ModuleStat key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-5 border-t border-border p-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[1.25rem]">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Decision queue</p>
                <h3 className="mt-1 font-heading text-lg font-semibold">
                  What needs attention in this module
                </h3>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/alerts">Open alerts</Link>
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {relevantAlerts.length === 0 ? (
                <div className="rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-muted-foreground">
                  No active module-specific blockers are visible for your role.
                </div>
              ) : (
                relevantAlerts.slice(0, 5).map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                    className="block rounded-2xl border border-border bg-surface-alt/45 p-4 transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{alert.subtitle}</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
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
          </CardContent>
        </Card>

        <Card className="rounded-[1.25rem]">
          <CardContent className="p-5">
            <p className="label-caps">Open the actual workspace</p>
            <h3 className="mt-1 font-heading text-lg font-semibold">
              Dashboard first, transaction second
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Use this panel to decide what matters. Then open the operational
              workspace to receive, approve, invoice, collect, dispatch, or report.
            </p>
            <div className="mt-4 grid gap-2">
              {actions.map((action) => (
                <Button key={action.href} asChild variant="outline" className="justify-between">
                  <Link href={action.href}>
                    {action.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-surface-alt/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                SOP link
              </p>
              <p className="mt-2 text-sm">
                Follow the SOP Center for stakeholder handoff, exit gates, and
                cold-storage control rules before completing the workflow.
              </p>
              <Button asChild variant="ghost" size="sm" className="mt-3 px-0">
                <Link href="/sop">Open SOP Center</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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

function getModuleDashboardTitle(moduleId: DashboardModuleId) {
  if (moduleId === "warehouse") return "Cold-storage control before receiving, grading, picking, and dispatch.";
  if (moduleId === "sales") return "Pricing, margin, quote-to-order, and credit discipline in one view.";
  if (moduleId === "crm") return "Customer risk, onboarding, relationship flow, and account handoff.";
  if (moduleId === "finance") return "Receipts, payables, settlements, journals, and close readiness.";
  if (moduleId === "reports") return "Management reporting, exports, aging, and performance visibility.";
  if (moduleId === "import-docs") return "Container, BL, document, clearance, and port-risk cockpit.";
  if (moduleId === "procurement") return "Supplier sourcing and purchase planning control surface.";
  return "System configuration, access, master data, and operating controls.";
}

function getModuleDashboardDescription(moduleId: DashboardModuleId) {
  if (moduleId === "warehouse") {
    return "Use this dashboard to decide what to receive, what is blocked by documents or detention risk, and when to move into stock, cycle count, or dispatch execution.";
  }
  if (moduleId === "sales") {
    return "Use this dashboard before touching orders: verify day-price discipline, margin leakage, quote conversion, and customer credit pressure.";
  }
  if (moduleId === "crm") {
    return "Use this dashboard to see whether customers are safe to onboard, sell to, follow up with, or put through credit/collections review.";
  }
  if (moduleId === "finance") {
    return "Use this dashboard to control cash exposure, receipts, payables, dispute credits, journals, and finance-period close readiness.";
  }
  if (moduleId === "reports") {
    return "Use this dashboard to decide what leadership needs to see, then export the management pack or drill into reports.";
  }
  if (moduleId === "import-docs") {
    return "Use this dashboard to keep every container and BL moving through documentation, clearance, and shipment checkpoints before warehouse handoff.";
  }
  if (moduleId === "procurement") {
    return "Use this dashboard as the future sourcing desk for supplier planning, purchase approvals, import sourcing, and negotiated terms.";
  }
  return "Use this dashboard to verify roles, permissions, integrations, master data, and workflow configuration before scaling the ERP.";
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
    <div className="rounded-2xl border border-border bg-surface-alt/45 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-financial text-2xl font-bold", tone)}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function ModuleLauncher() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-caps">Module launcher</p>
          <h2 className="mt-1 font-heading text-2xl font-bold">
            Open the business area you want to work in
          </h2>
        </div>
        <p className="hidden max-w-xl text-sm text-muted-foreground md:block">
          Each module opens its own dashboard and sub-workflows. The home screen
          is now the entry point, not the entire ERP.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((module) => {
          const Icon = module.icon;
          const comingSoon = module.status.toLowerCase().includes("coming");

          return (
            <Link
              key={module.title}
              href={module.href}
              className={cn(
                "group relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg",
                comingSoon && "opacity-85"
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
                  module.tone
                )}
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_38%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="space-y-3">
                  <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                    {module.status}
                  </div>
                  <div className="rounded-2xl bg-slate-950/20 p-3 text-white ring-1 ring-white/10 backdrop-blur">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <ArrowRight className="mt-2 h-5 w-5 text-white/70 transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="relative mt-6 space-y-2 text-white">
                <h3 className="font-heading text-xl font-bold">{module.title}</h3>
                <p className="text-sm leading-6 text-white/80">{module.description}</p>
              </div>

              <div className="relative mt-5 flex flex-wrap gap-2">
                {module.submodules.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="relative mt-5 text-sm font-semibold text-white/95">
                {comingSoon ? "Planning in progress" : "Open module"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function DecisionCockpit({
  data,
  workbench,
  showFinancials,
}: {
  data: Analytics | null;
  workbench: PersonalAlertSummary | null;
  showFinancials: boolean;
}) {
  const k = data?.kpis;
  const activeAlerts = workbench?.active ?? [];
  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical");
  const blockedDocs = k?.pendingDocs ?? 0;
  const detention = workbench?.detentionCount ?? 0;
  const margin = k?.avgMargin ?? null;
  const lossRows = (data?.bottom5 ?? []).filter((row) => row.profit < 0);
  const apRows = data?.paymentOutstandingByCurrency ?? [];
  const apOpenCount = apRows.reduce((sum, row) => sum + row.count, 0);
  const apExposureLabel =
    apRows
      .filter((row) => row.amount > 0)
      .map((row) => formatMoney(row.amount, row.currency))
      .join(" / ") || "Clear";

  const decisions = [
    {
      label: "Critical decisions",
      value: criticalAlerts.length,
      text:
        criticalAlerts.length > 0
          ? "Resolve these first: they can stop clearance, dispatch, or cash flow."
          : "No critical exception is currently visible to your role.",
      href: "/alerts",
      tone: criticalAlerts.length > 0 ? "danger" : "success",
      icon: ShieldAlert,
    },
    {
      label: "Detention watch",
      value: detention,
      text:
        detention > 0
          ? "Free-day risk exists. Clear port/warehouse blockers before charges build."
          : "No detention-risk container is in your active alert queue.",
      href: "/alerts",
      tone: detention > 0 ? "warning" : "success",
      icon: Clock3,
    },
    {
      label: "Document blockers",
      value: blockedDocs,
      text:
        blockedDocs > 0
          ? "Docs need eyes before downstream clearance, finance, or delivery decisions."
          : "Document queue looks clean from the dashboard summary.",
      href: "/documents",
      tone: blockedDocs > 0 ? "warning" : "success",
      icon: ClipboardCheck,
    },
  ] as const;

  return (
    <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className="overflow-hidden rounded-[1.75rem] border-slate-300 bg-slate-950 text-white shadow-card dark:border-border">
        <CardContent className="p-0">
          <div className="grid min-h-[320px] gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative overflow-hidden p-6 md:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.36),transparent_24rem),radial-gradient(circle_at_85%_10%,rgba(245,158,11,0.28),transparent_22rem)]" />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                  Aeden live decision desk
                </p>
                <h2 className="mt-4 max-w-2xl font-heading text-4xl font-bold tracking-tight md:text-5xl">
                  Act on the bottleneck before it becomes loss.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-200">
                  This dashboard is ordered by business consequence: port risk,
                  document blockers, credit exposure, margin leakage, and the next
                  ERP workspace to open.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <DarkMetric
                    label="Containers"
                    value={(k?.totalContainers ?? 0).toLocaleString("en-IN")}
                    hint="Live import trail"
                  />
                  <DarkMetric
                    label="Avg Margin"
                    value={showFinancials && margin != null ? `${margin.toFixed(1)}%` : "Restricted"}
                    hint={showFinancials ? "Approved sales" : "Role hidden"}
                    tone={showFinancials ? marginColor(margin) : undefined}
                  />
                  <DarkMetric
                    label="Profit"
                    value={showFinancials ? formatINR(k?.totalProfit ?? 0) : "Restricted"}
                    hint={showFinancials ? "Net container result" : "Role hidden"}
                    tone={showFinancials && (k?.totalProfit ?? 0) < 0 ? "text-red-300" : "text-emerald-300"}
                  />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild className="bg-white text-slate-950 hover:bg-sky-50">
                    <Link href="/alerts">Resolve exceptions</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  >
                    <Link href="/sop">Open SOP for process</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 bg-white/[0.06] p-5 lg:border-l lg:border-t-0">
              {decisions.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "group rounded-2xl border p-4 transition hover:-translate-y-0.5",
                      item.tone === "danger"
                        ? "border-red-300/40 bg-red-400/15"
                        : item.tone === "warning"
                          ? "border-amber-200/40 bg-amber-300/15"
                          : "border-emerald-200/30 bg-emerald-400/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                          {item.label}
                        </p>
                        <p className="mt-2 font-financial text-4xl font-bold">
                          {item.value}
                        </p>
                      </div>
                      <Icon className="h-5 w-5 text-white/75 transition group-hover:scale-110" />
                    </div>
                    <p className="mt-3 text-sm leading-5 text-slate-200">{item.text}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-300 bg-card shadow-card">
        <CardContent className="space-y-5 p-6">
          <div>
            <p className="label-caps">Commercial pressure</p>
            <h3 className="mt-1 font-heading text-xl font-bold">
              Money and margin signals
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-muted-foreground">
              Useful only for roles allowed to see finance.
            </p>
          </div>

          {showFinancials ? (
            <>
              <div className="grid gap-3">
                <LightMetric
                  label="Outstanding AP exposure"
                  value={apExposureLabel}
                  hint={`${apOpenCount} open payments across currencies`}
                  tone={apOpenCount > 0 ? "danger" : "neutral"}
                />
                <LightMetric
                  label="Loss-making containers"
                  value={lossRows.length.toString()}
                  hint={lossRows.length > 0 ? "Review bottom performers before repeat buying" : "No loss rows in bottom-five summary"}
                  tone={lossRows.length > 0 ? "danger" : "neutral"}
                />
                <LightMetric
                  label="Customs speed"
                  value={k?.avgCustomsDays == null ? "No data" : `${k.avgCustomsDays.toFixed(1)}d`}
                  hint="Average ATA to BE date"
                  tone={(k?.avgCustomsDays ?? 0) > 3 ? "warning" : "neutral"}
                />
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/reports">Open management reports</Link>
              </Button>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700 dark:border-border dark:bg-surface-alt dark:text-muted-foreground">
              Financial signals are hidden for this role. Operational risks remain visible in the workbench.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DarkMetric({
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
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <p className={cn("mt-2 font-financial text-2xl font-bold text-white", tone)}>{value}</p>
      <p className="mt-1 text-xs text-slate-300">{hint}</p>
    </div>
  );
}

function LightMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "danger" | "warning" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-slate-50 p-4 dark:bg-surface-alt",
        tone === "danger" && "border-red-300 bg-red-50 dark:border-danger/30 dark:bg-danger/10",
        tone === "warning" && "border-amber-300 bg-amber-50 dark:border-warning/30 dark:bg-warning/10",
        (!tone || tone === "neutral") && "border-slate-300 dark:border-border"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-financial text-2xl font-bold text-slate-950 dark:text-foreground",
          tone === "danger" && "text-red-700 dark:text-danger",
          tone === "warning" && "text-amber-700 dark:text-warning"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-600 dark:text-muted-foreground">{hint}</p>
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
                <p className="label-caps">Operations workbench</p>
                <h2 className="mt-1 font-heading text-2xl font-bold">
                  My work today
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Role-aware next actions for your {role.replace("_", " ")} queue.
                </p>
              </div>
              <div className="flex gap-2">
                <BadgeStat label="Unread" value={data?.unreadCount ?? 0} />
                <BadgeStat
                  label="Critical"
                  value={data?.criticalCount ?? 0}
                  tone="danger"
                />
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
                        <p className="text-sm text-muted-foreground">{a.subtitle}</p>
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
  paymentOutstandingByCurrency,
}: {
  activeContainers: number;
  pendingDocs: number;
  detentionCount: number;
  paymentOutstandingByCurrency: {
    currency: "USD" | "AED" | "INR";
    amount: number;
    count: number;
  }[];
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
            {BRAND_SHORT_NAME} live desk
          </div>
          <h2 className="mt-5 max-w-3xl font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Run imports, cold rooms, sales, finance, and customer risk from one command layer.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-sky-100/80 md:text-base">
            The top level is now a module hub. The operational cockpit still shows
            what is late, what needs approval, and where money or documents are
            blocking flow.
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
          {paymentOutstandingByCurrency.map((row) => (
            <div
              key={row.currency}
              className="rounded-2xl border border-amber-200/20 bg-amber-300/10 p-4 text-amber-50"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/70">
                Outstanding AP ({row.currency})
              </p>
              <p className="font-financial mt-1 text-2xl font-bold">
                {formatMoney(row.amount, row.currency)}
              </p>
              <p className="mt-1 text-xs text-amber-100/80">
                {row.count} open payment{row.count === 1 ? "" : "s"}
              </p>
            </div>
          ))}
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
  rows: {
    containerNo: string;
    supplier: string | null;
    profit: number;
    marginPct: number | null;
  }[];
}) {
  return (
    <Card className="lift-card overflow-hidden rounded-[1.5rem]">
      <CardContent className="pt-6">
        <h3 className="mb-3 font-heading text-base font-semibold">{title}</h3>
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
                    <p
                      className={cn(
                        "font-financial text-xs",
                        marginColor(r.marginPct)
                      )}
                    >
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
