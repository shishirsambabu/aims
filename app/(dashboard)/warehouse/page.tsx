import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listWarehouses, type WarehouseRecord } from "@/lib/data/warehouses";
import {
  getEligibleStockContainers,
  listWarehouseInwardContainers,
  listStockItems,
  type WarehouseInwardContainerRow,
  type StockItemRow,
} from "@/lib/data/stock";
import { listGatePasses, type GatePassRow } from "@/lib/data/dispatch";
import {
  listWarehouseAdvancedOps,
  listWarehouseCycleCounts,
  listWarehouseLocations,
  type WarehouseAdvancedOpsRow,
} from "@/lib/data/warehouse-ops";
import { StockManager } from "@/components/warehouse/StockManager";
import { CycleCountManager } from "@/components/warehouse/CycleCountManager";
import { ColdChainWorkspace } from "@/components/warehouse/ColdChainWorkspace";
import { WarehouseSopCommandCenter } from "@/components/warehouse/WarehouseSopCommandCenter";
import { WarehouseAdvancedOps } from "@/components/warehouse/WarehouseAdvancedOps";
import { getColdChainWorkspace } from "@/lib/data/cold-chain";
import { getWarehouseSopMetrics, type WarehouseSopMetrics } from "@/lib/data/warehouse-sop";
import { cn } from "@/lib/utils";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

type WarehouseSection = "inward" | "processing" | "outward";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const SECTION_META: Record<WarehouseSection, { title: string; description: string }> = {
  inward: {
    title: "Warehouse Inward",
    description: "See containers assigned by the document/import team, receive them into cold storage, and create the first lot trail.",
  },
  processing: {
    title: "Grading / Repacking / Packing",
    description: "Grade received lots, repack or split stock, handle quality exceptions, run cycle counts, and keep FEFO visible.",
  },
  outward: {
    title: "Warehouse Outward",
    description: "Move approved sales loads through pick, pack, ready, fleet, security gate, dispatch, POD, and return assets.",
  },
};

function getSection(tab: string | undefined): WarehouseSection {
  if (tab === "processing" || tab === "cycle-counts" || tab === "stock") return "processing";
  if (tab === "outward" || tab === "dispatch") return "outward";
  return "inward";
}

export default async function WarehousePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const section = getSection(params.tab);
  const meta = SECTION_META[section];
  const session = await requireSession();
  requirePageAccess(session.role, ["inventory.view"]);
  const canView =
    can(session.role, "inventory.view") || can(session.role, "warehouse.receive");

  let stock: StockItemRow[] = [];
  let warehouses: WarehouseRecord[] = [];
  let containers: Awaited<ReturnType<typeof getEligibleStockContainers>> = [];
  let inwardContainers: WarehouseInwardContainerRow[] = [];
  let gatePasses: GatePassRow[] = [];
  let locations: Awaited<ReturnType<typeof listWarehouseLocations>> = [];
  let cycleCounts: Awaited<ReturnType<typeof listWarehouseCycleCounts>> = [];
  let advancedOps: WarehouseAdvancedOpsRow = {
    dockAppointments: [],
    putawayRules: [],
    repackingWorkOrders: [],
    qcSamplingPlans: [],
    productivityLogs: [],
    exceptionApprovals: [],
    supplierClaims: [],
  };
  let coldChain: Awaited<ReturnType<typeof getColdChainWorkspace>> = {
    summary: { readings: 0, openTasks: 0, criticalTasks: 0, resolvedTasks: 0 },
    readings: [],
    tasks: [],
  };
  let sopMetrics: WarehouseSopMetrics = {
    kpis: {
      receivingAccuracyPct: null,
      inventoryAccuracyPct: null,
      dispatchAccuracyPct: null,
      coldChainCompliancePct: null,
      wastagePct: null,
      varianceClosurePct: null,
      ncClosurePct: null,
      totals: {
        receivedLots: 0,
        cleanReceivedLots: 0,
        cycleCountLines: 0,
        zeroVarianceLines: 0,
        openVariances: 0,
        closedVariances: 0,
        gatePasses: 0,
        cleanDispatchedGatePasses: 0,
        coldReadings: 0,
        inSpecColdReadings: 0,
        openNcLots: 0,
        closedNcLots: 0,
        wastageQty: 0,
        receivedQty: 0,
      },
    },
    exceptions: [],
  };
  let loadError = false;

  try {
    [stock, warehouses, containers, inwardContainers, locations, cycleCounts, advancedOps, coldChain, sopMetrics] = await Promise.all([
      listStockItems(session.orgId),
      listWarehouses(session.orgId),
      getEligibleStockContainers(session.orgId),
      listWarehouseInwardContainers(session.orgId),
      listWarehouseLocations(session.orgId),
      listWarehouseCycleCounts(session.orgId),
      listWarehouseAdvancedOps(session.orgId),
      getColdChainWorkspace(session.orgId),
      getWarehouseSopMetrics(session.orgId),
    ]);
    gatePasses = await listGatePasses(session.orgId);
  } catch (err) {
    console.error("[warehouse/page] load failed", err);
    loadError = true;
  }

  const totalStockLots = stock.length;
  const assignedInward = inwardContainers.length;
  const readyToReceive = inwardContainers.filter((row) => row.status === "InWarehouse").length;
  const upstreamPending = inwardContainers.filter((row) => row.status !== "InWarehouse").length;
  const availableQty = stock
    .filter((row) => row.qualityStatus === "Released")
    .reduce((sum, row) => sum + row.qtyAvailable, 0);
  const reservedQty = stock.reduce((sum, row) => sum + row.qtyReserved, 0);
  const criticalLots = stock.filter((row) =>
    ["expired", "critical"].includes(row.expiryBand)
  ).length;
  const openGatePasses = gatePasses.filter((pass) => pass.status !== "Dispatched").length;
  const heldLots = stock.filter((row) => row.qualityStatus !== "Released").length;
  const gateExitPending = gatePasses.filter(
    (pass) => pass.status === "Ready" && !pass.securityGateOutAt
  ).length;
  const podPending = gatePasses.filter(
    (pass) => pass.status === "Dispatched" && !pass.podRef
  ).length;
  const returnAssetPending = gatePasses.filter(
    (pass) =>
      pass.returnCratesReceived < pass.returnCratesPlanned ||
      pass.returnPalletsReceived < pass.returnPalletsPlanned
  ).length;

  return (
    <div>
      <PageHeader
        title={meta.title}
        description={meta.description}
      />

      <div className="space-y-4 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load warehouse stock</p>
              <p className="text-muted-foreground">
                Warehouse data could not be loaded. Retry once; if it continues, ask an administrator to review the server log.
              </p>
            </div>
          </div>
        ) : !canView ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            You do not have permission to view warehouse stock.
          </div>
        ) : (
          <>
            <WarehouseSubnav active={section} />

            <WarehouseFlowMap
              active={section}
              metrics={{
                assignedInward,
                readyToReceive,
                upstreamPending,
                totalStockLots,
                availableQty,
                criticalLots,
                heldLots,
                openGatePasses,
                gateExitPending,
                podPending,
                returnAssetPending,
              }}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <WarehouseStatCard
                label="Assigned Inward"
                value={assignedInward.toString()}
                hint="Containers routed to warehouse"
                tone={assignedInward > 0 ? "text-primary" : undefined}
              />
              <WarehouseStatCard
                label="Ready To Receive"
                value={readyToReceive.toString()}
                hint="Status is In Warehouse"
                tone={readyToReceive > 0 ? "text-success" : undefined}
              />
              <WarehouseStatCard
                label="Upstream Pending"
                value={upstreamPending.toString()}
                hint="Docs/clearance/arrival before receiving"
                tone={upstreamPending > 0 ? "text-warning" : undefined}
              />
              <WarehouseStatCard
                label="Stock Lots"
                value={totalStockLots.toString()}
                hint="Received active lots"
              />
              <WarehouseStatCard
                label="Open Outward"
                value={openGatePasses.toString()}
                hint="Gate passes in progress"
              />
            </div>

            <WarehouseFunctionMatrix
              active={section}
              metrics={{
                readyToReceive,
                heldLots,
                criticalLots,
                gateExitPending,
                podPending,
                returnAssetPending,
              }}
            />

            {section === "inward" ? (
              <>
                <WarehouseAdvancedOps
                  section={section}
                  advancedOps={advancedOps}
                  warehouses={warehouses}
                  locations={locations}
                  stock={stock}
                  inwardContainers={inwardContainers}
                  gatePasses={gatePasses}
                  canManage={can(session.role, "warehouse.receive") || can(session.role, "warehouse.adjust")}
                />
                <StockManager
                  stock={stock}
                  warehouses={warehouses}
                  containers={containers}
                  inwardContainers={inwardContainers}
                  gatePasses={gatePasses}
                  locations={locations}
                  cycleCounts={cycleCounts}
                  canReceive={can(session.role, "warehouse.receive")}
                  canAdjust={can(session.role, "warehouse.adjust")}
                  canFulfil={can(session.role, "warehouse.fulfil")}
                  viewMode="inward"
                />
              </>
            ) : null}

            {section === "processing" ? (
              <>
                <WarehouseAdvancedOps
                  section={section}
                  advancedOps={advancedOps}
                  warehouses={warehouses}
                  locations={locations}
                  stock={stock}
                  inwardContainers={inwardContainers}
                  gatePasses={gatePasses}
                  canManage={can(session.role, "warehouse.adjust") || can(session.role, "coldchain.manage")}
                />
                <StockManager
                  stock={stock}
                  warehouses={warehouses}
                  containers={containers}
                  inwardContainers={inwardContainers}
                  gatePasses={gatePasses}
                  locations={locations}
                  cycleCounts={cycleCounts}
                  canReceive={can(session.role, "warehouse.receive")}
                  canAdjust={can(session.role, "warehouse.adjust")}
                  canFulfil={can(session.role, "warehouse.fulfil")}
                  viewMode="processing"
                />

                <ColdChainWorkspace
                  data={JSON.parse(JSON.stringify(coldChain))}
                  warehouses={warehouses}
                  locations={locations}
                  canManage={can(session.role, "coldchain.manage")}
                />
                <CycleCountManager
                  warehouses={warehouses}
                  stockItems={stock}
                  cycleCounts={cycleCounts}
                />
              </>
            ) : null}

            {section === "outward" ? (
              <>
                <WarehouseAdvancedOps
                  section={section}
                  advancedOps={advancedOps}
                  warehouses={warehouses}
                  locations={locations}
                  stock={stock}
                  inwardContainers={inwardContainers}
                  gatePasses={gatePasses}
                  canManage={can(session.role, "warehouse.fulfil") || can(session.role, "warehouse.adjust")}
                />
                <StockManager
                  stock={stock}
                  warehouses={warehouses}
                  containers={containers}
                  inwardContainers={inwardContainers}
                  gatePasses={gatePasses}
                  locations={locations}
                  cycleCounts={cycleCounts}
                  canReceive={can(session.role, "warehouse.receive")}
                  canAdjust={can(session.role, "warehouse.adjust")}
                  canFulfil={can(session.role, "warehouse.fulfil")}
                  viewMode="dispatch"
                />
              </>
            ) : null}

            <WarehouseSopCommandCenter
              stock={stock}
              warehouses={warehouses}
              containers={containers}
              gatePasses={gatePasses}
              cycleCounts={cycleCounts}
              coldChain={JSON.parse(JSON.stringify(coldChain))}
              sopMetrics={sopMetrics}
            />
          </>
        )}
      </div>
    </div>
  );
}

function WarehouseFunctionMatrix({
  active,
  metrics,
}: {
  active: WarehouseSection;
  metrics: {
    readyToReceive: number;
    heldLots: number;
    criticalLots: number;
    gateExitPending: number;
    podPending: number;
    returnAssetPending: number;
  };
}) {
  const items = [
    {
      head: "Inward",
      control: "GRN, dock receipt, putaway, temperature-at-receipt",
      owner: "Receiver / Storekeeper",
      status: metrics.readyToReceive > 0 ? `${metrics.readyToReceive} ready` : "clear",
      href: "/warehouse",
      section: "inward" as WarehouseSection,
    },
    {
      head: "Quality",
      control: "grading, quarantine, wastage, release, FEFO",
      owner: "QC / Supervisor",
      status:
        metrics.heldLots + metrics.criticalLots > 0
          ? `${metrics.heldLots + metrics.criticalLots} exceptions`
          : "clear",
      href: "/warehouse?tab=processing",
      section: "processing" as WarehouseSection,
    },
    {
      head: "Outward",
      control: "pick, pack, seal, OTP gate, dispatch, POD, return assets",
      owner: "Packing / Billing / Security",
      status:
        metrics.gateExitPending + metrics.podPending + metrics.returnAssetPending > 0
          ? `${metrics.gateExitPending + metrics.podPending + metrics.returnAssetPending} closures`
          : "clear",
      href: "/warehouse?tab=outward",
      section: "outward" as WarehouseSection,
    },
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.head}
          href={item.href}
          className={cn(
            "rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary/60 hover:shadow-card",
            active === item.section && "border-primary bg-primary/5"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {item.head}
              </p>
              <h3 className="mt-1 font-heading text-base font-semibold">{item.control}</h3>
            </div>
            <Badge variant={item.status === "clear" ? "success" : "warning"}>
              {item.status}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Owner: {item.owner}</p>
        </Link>
      ))}
    </section>
  );
}

function WarehouseSubnav({ active }: { active: WarehouseSection }) {
  const links: { label: string; href: string; section: WarehouseSection }[] = [
    { label: "Inward", href: "/warehouse", section: "inward" },
    { label: "Grading / Repacking / Packing", href: "/warehouse?tab=processing", section: "processing" },
    { label: "Outward", href: "/warehouse?tab=outward", section: "outward" },
  ];
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-2 shadow-sm">
      {links.map((link) => (
        <Button
          key={link.section}
          asChild
          variant={active === link.section ? "default" : "ghost"}
          size="sm"
        >
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </div>
  );
}

function WarehouseFlowMap({
  active,
  metrics,
}: {
  active: WarehouseSection;
  metrics: {
    assignedInward: number;
    readyToReceive: number;
    upstreamPending: number;
    totalStockLots: number;
    availableQty: number;
    criticalLots: number;
    heldLots: number;
    openGatePasses: number;
    gateExitPending: number;
    podPending: number;
    returnAssetPending: number;
  };
}) {
  const steps: {
    id: WarehouseSection;
    title: string;
    owner: string;
    queue: string;
    blocker: string;
    signal: string;
    action: string;
    href: string;
    tone: "success" | "warning" | "danger" | "default";
  }[] = [
    {
      id: "inward",
      title: "Inward",
      owner: "Document/import -> Warehouse receiver",
      queue: `${metrics.assignedInward} assigned`,
      blocker: `${metrics.upstreamPending} upstream pending`,
      signal: `${metrics.readyToReceive} ready for GRN`,
      action: "Receive containers",
      href: "/warehouse",
      tone: metrics.readyToReceive > 0 ? "success" : metrics.upstreamPending > 0 ? "warning" : "default",
    },
    {
      id: "processing",
      title: "Grading / Repacking / Packing",
      owner: "Supervisor, QC, storekeeper, packing",
      queue: `${metrics.totalStockLots} live lots`,
      blocker: `${metrics.heldLots + metrics.criticalLots} exceptions`,
      signal: `${Math.round(metrics.availableQty).toLocaleString("en-IN")} available`,
      action: "Process lots",
      href: "/warehouse?tab=processing",
      tone: metrics.heldLots + metrics.criticalLots > 0 ? "warning" : "success",
    },
    {
      id: "outward",
      title: "Outward",
      owner: "Sales -> warehouse -> billing -> security -> driver",
      queue: `${metrics.openGatePasses} open loads`,
      blocker: `${metrics.gateExitPending + metrics.podPending + metrics.returnAssetPending} closures pending`,
      signal: `${metrics.gateExitPending} gate exits`,
      action: "Clear dispatch",
      href: "/warehouse?tab=outward",
      tone:
        metrics.gateExitPending + metrics.podPending + metrics.returnAssetPending > 0
          ? "warning"
          : metrics.openGatePasses > 0
            ? "success"
            : "default",
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-caps">Warehouse control tower</p>
          <h2 className="font-heading text-2xl font-semibold">
            Live handoffs, blockers, and next actions.
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface-alt/40 p-2 text-center text-xs">
          <div className="rounded-xl bg-background px-3 py-2">
            <p className="font-financial text-lg font-semibold">{metrics.readyToReceive}</p>
            <p className="text-muted-foreground">GRN ready</p>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <p className="font-financial text-lg font-semibold">{metrics.heldLots}</p>
            <p className="text-muted-foreground">quality hold</p>
          </div>
          <div className="rounded-xl bg-background px-3 py-2">
            <p className="font-financial text-lg font-semibold">{metrics.gateExitPending}</p>
            <p className="text-muted-foreground">gate pending</p>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "relative rounded-lg border p-4",
              active === step.id
                ? "border-primary bg-primary/10"
                : "border-border bg-surface-alt/30"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-financial flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                {index + 1}
              </span>
              <Badge variant={active === step.id ? "default" : step.tone === "warning" ? "warning" : step.tone === "danger" ? "danger" : step.tone === "success" ? "success" : "outline"}>
                {active === step.id ? "Open" : "Monitor"}
              </Badge>
            </div>
            <h3 className="mt-3 font-heading text-lg font-semibold">{step.title}</h3>
            <p className="mt-1 text-xs font-medium text-primary">{step.owner}</p>
            <div className="mt-4 grid gap-2">
              <FlowMetric label="Queue" value={step.queue} />
              <FlowMetric label="Blocker" value={step.blocker} />
              <FlowMetric label="Signal" value={step.signal} />
            </div>
            <Button asChild className="mt-4 w-full" variant={active === step.id ? "default" : "outline"}>
              <Link href={step.href}>{step.action}</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FlowMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function WarehouseStatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("font-financial mt-1 text-2xl font-bold", tone)}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
