"use client";

import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  LockKeyhole,
  PackageCheck,
  Printer,
  ShieldAlert,
  Thermometer,
  Truck,
  Users2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import type { GatePassRow } from "@/lib/data/dispatch";
import type { StockItemRow } from "@/lib/data/stock";
import type { WarehouseCycleCountRow } from "@/lib/data/warehouse-ops";
import type { WarehouseSopMetrics } from "@/lib/data/warehouse-sop";

type ReceiveContainer = {
  id: string;
  containerNo: string;
  blNo: string;
  item: string | null;
  variety: string | null;
  noOfBoxes: number | null;
  warehouse: { name: string; code: string } | null;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
  city: string;
};

type ColdChainData = {
  summary: { readings: number; openTasks: number; criticalTasks: number; resolvedTasks: number };
  tasks: {
    id: string;
    taskNo: string;
    warehouseName: string;
    locationName: string | null;
    severity: string;
    status: string;
    title: string;
    description: string | null;
    createdAt: string;
  }[];
};

const ROLE_QUEUES = [
  "Manager",
  "AWM",
  "Supervisor",
  "Storekeeper",
  "Billing",
  "Security",
  "Packing",
] as const;

const SOP_TEMPLATES = [
  {
    id: "grn",
    title: "Goods Received Note",
    formNo: "AEDEN/WH/T-01",
    owner: "Storekeeper",
    href: "/warehouse/templates?template=grn",
    fields: ["Container / Vehicle", "Product", "Grade", "Boxes/Pallets", "Net Wt", "Pulp Temp", "Condition", "Location"],
  },
  {
    id: "grading",
    title: "QC / Grading Report",
    formNo: "AEDEN/WH/T-02",
    owner: "Supervisor / QC",
    href: "/warehouse/templates?template=grading",
    fields: ["Source GRN", "Grade A", "Grade B", "Reject/Waste", "Input Weight", "Variance", "Yield Check"],
  },
  {
    id: "repacking",
    title: "Repacking Log",
    formNo: "AEDEN/WH/T-03",
    owner: "Packing Supervisor",
    href: "/warehouse/templates?template=repacking",
    fields: ["Order / Ref", "Pack Spec", "Input Used", "Finished Packs", "Wastage", "Balance OK"],
  },
  {
    id: "temperature",
    title: "Cold Storage / Ripening Temperature Log",
    formNo: "AEDEN/WH/T-04",
    owner: "Supervisor",
    href: "/warehouse/templates?template=temperature",
    fields: ["Room", "Target Temp", "Product Held", "Temp", "Humidity", "Within Spec", "Action"],
  },
  {
    id: "dispatch",
    title: "Pick & Dispatch Sheet",
    formNo: "AEDEN/WH/T-05",
    owner: "Supervisor / Billing",
    href: "/warehouse/templates?template=dispatch",
    fields: ["Customer", "Order Ref", "Vehicle", "Ordered", "Picked", "QC OK", "Loaded", "Invoice Qty"],
  },
  {
    id: "reconciliation",
    title: "Daily Stock Reconciliation",
    formNo: "AEDEN/WH/T-06",
    owner: "Storekeeper",
    href: "/warehouse/templates?template=reconciliation",
    fields: ["Opening", "Inward", "Repack In", "Dispatched", "Wastage", "System Closing", "Physical", "Variance"],
  },
  {
    id: "nc",
    title: "Non-Conformance / Quarantine / Wastage",
    formNo: "AEDEN/WH/T-07",
    owner: "Supervisor",
    href: "/warehouse/templates?template=nc",
    fields: ["Stage", "Product / GRN", "Issue", "Root Cause", "Action", "Disposition", "Escalated To"],
  },
  {
    id: "gate-pass",
    title: "Gate Pass",
    formNo: "AEDEN/WH/T-08",
    owner: "Billing / Security",
    href: "/warehouse/templates?template=gate-pass",
    fields: ["Customer", "Invoice", "Challan", "Vehicle", "Driver", "Packages", "Documents", "Gate Check"],
  },
] as const;

function formatPct(value: number | null) {
  return value == null ? "No data" : `${value.toFixed(1)}%`;
}

function pctTone(value: number | null, target: number, reverse = false) {
  if (value == null) return "text-muted-foreground";
  if (reverse) {
    if (value <= target) return "text-success";
    if (value <= target * 2) return "text-warning";
    return "text-danger";
  }
  if (value >= target) return "text-success";
  if (value >= target - 5) return "text-warning";
  return "text-danger";
}

function safeDate(value: string | null) {
  return value ? formatDate(value) : "Not recorded";
}

export function WarehouseSopCommandCenter({
  stock,
  warehouses,
  containers,
  gatePasses,
  cycleCounts,
  coldChain,
  sopMetrics,
}: {
  stock: StockItemRow[];
  warehouses: WarehouseOption[];
  containers: ReceiveContainer[];
  gatePasses: GatePassRow[];
  cycleCounts: WarehouseCycleCountRow[];
  coldChain: ColdChainData;
  sopMetrics: WarehouseSopMetrics;
}) {
  const openGatePasses = gatePasses.filter((pass) => pass.status !== "Dispatched" && pass.status !== "Cancelled");
  const qualityExceptions = stock.filter((row) => row.qualityStatus !== "Released");
  const unlocatedLots = stock.filter((row) => !row.locationId);
  const activeLots = stock.filter((row) => row.qtyAvailable > 0);
  const recentLots = [...stock]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const roleQueues = buildRoleQueues({
    containers,
    gatePasses,
    cycleCounts,
    coldChain,
    qualityExceptions,
    unlocatedLots,
  });

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-card">
        <div className="relative overflow-hidden bg-slate-950 p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.32),transparent_24rem),radial-gradient(circle_at_82%_10%,rgba(46,132,74,0.28),transparent_18rem)]" />
          <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                Warehouse SOP operating layer
              </p>
              <h2 className="mt-4 font-heading text-3xl font-bold">
                Every movement needs a record, every record needs a physical check.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
                The current paper SOP is now mapped into ERP checkpoints: GRN,
                grading, repacking, cold-room logging, dispatch matching, stock
                reconciliation, non-conformance, and gate pass release.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild className="bg-white text-slate-950 hover:bg-sky-50">
                  <Link href="/sop">Open SOP Center</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                  <Link href="/warehouse?tab=outward">Open outward flow</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DarkMini label="Warehouses" value={warehouses.length.toString()} hint="Configured locations" />
              <DarkMini label="Active lots" value={activeLots.length.toString()} hint="Available warehouse lots" />
              <DarkMini label="Open gates" value={openGatePasses.length.toString()} hint="Dispatch in progress" />
              <DarkMini label="Exceptions" value={sopMetrics.exceptions.length.toString()} hint="Needs review" tone={sopMetrics.exceptions.length > 0 ? "text-amber-200" : "text-emerald-200"} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <SopKpi label="Receiving accuracy" value={formatPct(sopMetrics.kpis.receivingAccuracyPct)} target="Target >= 99%" tone={pctTone(sopMetrics.kpis.receivingAccuracyPct, 99)} />
          <SopKpi label="Inventory accuracy" value={formatPct(sopMetrics.kpis.inventoryAccuracyPct)} target="Target >= 98%" tone={pctTone(sopMetrics.kpis.inventoryAccuracyPct, 98)} />
          <SopKpi label="Dispatch accuracy" value={formatPct(sopMetrics.kpis.dispatchAccuracyPct)} target="Target >= 97%" tone={pctTone(sopMetrics.kpis.dispatchAccuracyPct, 97)} />
          <SopKpi label="Cold-chain compliance" value={formatPct(sopMetrics.kpis.coldChainCompliancePct)} target="Target >= 99%" tone={pctTone(sopMetrics.kpis.coldChainCompliancePct, 99)} />
          <SopKpi label="Wastage %" value={formatPct(sopMetrics.kpis.wastagePct)} target="Target < 1.5%" tone={pctTone(sopMetrics.kpis.wastagePct, 1.5, true)} />
          <SopKpi label="Variance closure" value={formatPct(sopMetrics.kpis.varianceClosurePct)} target={`${sopMetrics.kpis.totals.openVariances} open variance(s)`} tone={pctTone(sopMetrics.kpis.varianceClosurePct, 100)} />
          <SopKpi label="NC closure" value={formatPct(sopMetrics.kpis.ncClosurePct)} target={`${sopMetrics.kpis.totals.openNcLots} open NC lot(s)`} tone={pctTone(sopMetrics.kpis.ncClosurePct, 95)} />
          <SopKpi label="Daily record trail" value={`${sopMetrics.kpis.totals.receivedLots}/${gatePasses.length}/${cycleCounts.length}`} target="GRN / gate pass / counts" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Role task queues</p>
                <h3 className="mt-1 font-heading text-lg font-semibold">
                  Warehouse work routed by SOP role
                </h3>
              </div>
              <Users2 className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {ROLE_QUEUES.map((role) => {
                const queue = roleQueues[role];
                return (
                  <div key={role} className="rounded-2xl border border-border bg-surface-alt/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-heading text-base font-semibold">{role}</p>
                      <Badge variant={queue.length > 0 ? "warning" : "outline"}>{queue.length}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {queue.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No open SOP task.</p>
                      ) : (
                        queue.slice(0, 3).map((task) => (
                          <Link
                            key={task.title}
                            href={task.href}
                            className="block rounded-xl border border-border bg-card px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-primary/5"
                          >
                            <p className="font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{task.detail}</p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem]">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Approval gates</p>
                <h3 className="mt-1 font-heading text-lg font-semibold">
                  Exceptions that cannot stay informal
                </h3>
              </div>
              <ShieldAlert className="h-5 w-5 text-warning" />
            </div>
            <div className="mt-4 space-y-3">
              {sopMetrics.exceptions.length === 0 ? (
                <div className="rounded-2xl border border-success/25 bg-success/5 p-4 text-sm text-muted-foreground">
                  No unresolved SOP exceptions from quality, temperature, variance, or dispatch matching.
                </div>
              ) : (
                sopMetrics.exceptions.slice(0, 8).map((item) => (
                  <Link
                    href={item.href}
                    key={`${item.type}-${item.id}`}
                    className="block rounded-2xl border border-border bg-surface-alt/40 p-4 transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                        <p className="mt-2 text-xs font-medium text-primary">Owner: {item.ownerRole}</p>
                      </div>
                      <Badge variant={item.severity === "critical" ? "danger" : "warning"}>{item.type}</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Lot lifecycle</p>
                <h3 className="mt-1 font-heading text-lg font-semibold">
                  GRN to dispatch traceability
                </h3>
              </div>
              <PackageCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 space-y-3">
              {recentLots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stock lots have been received yet.</p>
              ) : (
                recentLots.map((lot) => (
                  <div key={lot.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {lot.item}{lot.grade ? ` / ${lot.grade}` : ""} - {lot.containerNo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          BL {lot.blNo} - {lot.locationCode ?? "No location"} - Lot {lot.lotNo ?? lot.id.slice(0, 8)}
                        </p>
                      </div>
                      <Badge variant={lot.qualityStatus === "Released" ? "success" : lot.qualityStatus === "Rejected" ? "danger" : "warning"}>
                        {lot.qualityStatus}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                      <Step label="GRN" value={safeDate(lot.createdAt)} done />
                      <Step label="QC / Grade" value={lot.parentStockItemId ? "Split lot" : lot.grade ?? "Pending"} done={Boolean(lot.grade || lot.parentStockItemId)} />
                      <Step label="Reserve / Pick" value={lot.qtyReserved > 0 ? `${lot.qtyReserved} ${lot.uom}` : "Not reserved"} done={lot.qtyReserved > 0 || lot.qtySold > 0} />
                      <Step label="Dispatch" value={lot.qtySold > 0 ? `${lot.qtySold} ${lot.uom}` : "Pending"} done={lot.qtySold > 0} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem]">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-caps">Digital and printable SOP templates</p>
                <h3 className="mt-1 font-heading text-lg font-semibold">
                  Eight warehouse forms now mapped into ERP screens
                </h3>
              </div>
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {SOP_TEMPLATES.map((template) => (
                <div key={template.id} className="rounded-2xl border border-border bg-surface-alt/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{template.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.formNo} - Filled by {template.owner}
                      </p>
                    </div>
                    <Badge variant="outline">{template.fields.length} fields</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.fields.slice(0, 4).map((field) => (
                      <span key={field} className="rounded-full border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
                        {field}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={template.href}>Open digital form</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.print()}>
                      <Printer className="h-4 w-4" /> Print
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.5rem] border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="label-caps">Audit and evidence trail</p>
              <h3 className="mt-1 font-heading text-lg font-semibold">
                Exceptions need proof, reason, approval, and closure.
              </h3>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Stock receive, grade split, transfer, quality decision, wastage,
                dump, cycle-count variance, cold-chain breach, gate-pass status,
                and dispatch exceptions already write an ERP trail. Wastage/dump
                actions require an evidence reference. Upload photos, seal images,
                inspection notes, claim files, and quarantine proof through the
                private document manager, then paste the document/reference number
                into the exception evidence field.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/documents">Upload evidence document</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/settings/document-automation">Document automation</Link>
                </Button>
              </div>
            </div>
            <LockKeyhole className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function buildRoleQueues({
  containers,
  gatePasses,
  cycleCounts,
  coldChain,
  qualityExceptions,
  unlocatedLots,
}: {
  containers: ReceiveContainer[];
  gatePasses: GatePassRow[];
  cycleCounts: WarehouseCycleCountRow[];
  coldChain: ColdChainData;
  qualityExceptions: StockItemRow[];
  unlocatedLots: StockItemRow[];
}) {
  const openDispatch = gatePasses.filter((pass) => pass.status !== "Dispatched" && pass.status !== "Cancelled");
  const openCounts = cycleCounts.filter((count) => count.status !== "Completed");
  const criticalCold = coldChain.tasks.filter((task) => task.status !== "Resolved");

  return {
    Manager: [
      ...qualityExceptions.filter((lot) => lot.qualityStatus === "Rejected").slice(0, 2).map((lot) => ({
        title: `Approve rejected lot ${lot.containerNo}`,
        detail: lot.qualityHoldReason ?? "Quality rejection needs manager decision",
        href: "/warehouse",
      })),
      ...criticalCold.filter((task) => task.severity === "Critical").slice(0, 2).map((task) => ({
        title: `Cold-chain breach ${task.taskNo}`,
        detail: task.description ?? task.title,
        href: "/warehouse",
      })),
    ],
    AWM: [
      ...openCounts.slice(0, 2).map((count) => ({
        title: `Close cycle count ${count.countNo}`,
        detail: `${count.lineCount} line(s) pending reconciliation`,
        href: "/warehouse?tab=processing",
      })),
      ...unlocatedLots.slice(0, 2).map((lot) => ({
        title: `Assign location ${lot.containerNo}`,
        detail: `${lot.item}${lot.grade ? ` / ${lot.grade}` : ""} has no bin/location`,
        href: "/warehouse",
      })),
    ],
    Supervisor: [
      ...containers.slice(0, 2).map((container) => ({
        title: `Receive container ${container.containerNo}`,
        detail: `BL ${container.blNo} - create GRN and assign cold-room location`,
        href: "/warehouse",
      })),
      ...qualityExceptions.filter((lot) => lot.qualityStatus !== "Rejected").slice(0, 2).map((lot) => ({
        title: `Resolve quality hold ${lot.containerNo}`,
        detail: lot.qualityHoldReason ?? "QC decision needed",
        href: "/warehouse",
      })),
    ],
    Storekeeper: [
      ...containers.slice(0, 2).map((container) => ({
        title: `Create GRN ${container.containerNo}`,
        detail: `${container.noOfBoxes ?? "-"} expected boxes`,
        href: "/warehouse",
      })),
      ...openCounts.slice(0, 2).map((count) => ({
        title: `Enter count actuals ${count.countNo}`,
        detail: count.scheduledAt ? formatDate(count.scheduledAt) : "No schedule",
        href: "/warehouse?tab=processing",
      })),
    ],
    Billing: openDispatch.slice(0, 4).map((pass) => ({
      title: `Match invoice for ${pass.gatePassNo}`,
      detail: `${pass.customerName ?? "Direct dispatch"} - ${pass.status}`,
      href: "/warehouse?tab=outward",
    })),
    Security: openDispatch.filter((pass) => pass.status === "Ready" || pass.status === "PartiallyDispatched").slice(0, 4).map((pass) => ({
      title: `Gate check ${pass.gatePassNo}`,
      detail: `${pass.vehicleNo ?? "No vehicle"} - ${pass.remainingQty} remaining`,
      href: "/warehouse?tab=outward",
    })),
    Packing: openDispatch.filter((pass) => pass.status === "Picked" || pass.status === "Packed").slice(0, 4).map((pass) => ({
      title: `Pack dispatch ${pass.gatePassNo}`,
      detail: `${pass.totalQty} planned - FEFO ${pass.nextFefoDueInDays ?? "-"}d`,
      href: "/warehouse?tab=outward",
    })),
  } satisfies Record<(typeof ROLE_QUEUES)[number], { title: string; detail: string; href: string }[]>;
}

function DarkMini({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <p className={cn("mt-2 font-financial text-2xl font-bold", tone)}>{value}</p>
      <p className="mt-1 text-xs text-slate-300">{hint}</p>
    </div>
  );
}

function SopKpi({ label, value, target, tone }: { label: string; value: string; target: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-alt/45 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-financial text-2xl font-bold", tone)}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{target}</p>
    </div>
  );
}

function Step({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className={cn("rounded-xl border px-3 py-2", done ? "border-success/25 bg-success/5" : "border-border bg-surface-alt/35")}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}
