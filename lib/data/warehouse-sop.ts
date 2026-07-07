import "server-only";

import { prisma } from "@/lib/prisma";

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export interface WarehouseSopKpis {
  receivingAccuracyPct: number | null;
  inventoryAccuracyPct: number | null;
  dispatchAccuracyPct: number | null;
  coldChainCompliancePct: number | null;
  wastagePct: number | null;
  varianceClosurePct: number | null;
  ncClosurePct: number | null;
  totals: {
    receivedLots: number;
    cleanReceivedLots: number;
    cycleCountLines: number;
    zeroVarianceLines: number;
    openVariances: number;
    closedVariances: number;
    gatePasses: number;
    cleanDispatchedGatePasses: number;
    coldReadings: number;
    inSpecColdReadings: number;
    openNcLots: number;
    closedNcLots: number;
    wastageQty: number;
    receivedQty: number;
  };
}

export interface WarehouseSopExceptionRow {
  id: string;
  type: "Temperature" | "Quality Hold" | "Quarantine" | "Rejected" | "Variance" | "Dispatch";
  title: string;
  detail: string;
  ownerRole: string;
  severity: "critical" | "warning";
  href: string;
}

export interface WarehouseSopMetrics {
  kpis: WarehouseSopKpis;
  exceptions: WarehouseSopExceptionRow[];
}

export async function getWarehouseSopMetrics(orgId: string): Promise<WarehouseSopMetrics> {
  const [
    stockItems,
    cycleLines,
    gatePasses,
    coldReadingRows,
    coldTasks,
  ] = await Promise.all([
    prisma.stockItem.findMany({
      where: { orgId, deletedAt: null },
      select: {
        id: true,
        item: true,
        grade: true,
        qualityStatus: true,
        temperatureBreach: true,
        qualityHoldReason: true,
        qtyReceived: true,
        qtyWastage: true,
        qtyDump: true,
        container: { select: { containerNo: true, blNo: true } },
        warehouse: { select: { name: true } },
        location: { select: { code: true, name: true } },
      },
    }),
    prisma.warehouseCycleCountLine.findMany({
      where: { orgId },
      select: {
        id: true,
        variance: true,
        reason: true,
        stockItem: {
          select: {
            item: true,
            grade: true,
            container: { select: { containerNo: true } },
            warehouse: { select: { name: true } },
          },
        },
        cycleCount: { select: { countNo: true, status: true } },
      },
    }),
    prisma.gatePass.findMany({
      where: { orgId },
      select: {
        id: true,
        gatePassNo: true,
        status: true,
        exceptionReason: true,
        vehicleNo: true,
        salesOrder: { select: { orderNo: true, customer: { select: { name: true } } } },
        lines: { select: { qtyPlanned: true, qtyDispatched: true } },
      },
    }),
    prisma.coldRoomReading.findMany({
      where: { orgId },
      select: {
        id: true,
        temperatureC: true,
        warehouse: { select: { name: true, temperatureMinC: true, temperatureMaxC: true } },
        location: { select: { code: true, name: true, temperatureMinC: true, temperatureMaxC: true } },
      },
    }),
    prisma.temperatureBreachTask.findMany({
      where: { orgId },
      select: {
        id: true,
        taskNo: true,
        status: true,
        severity: true,
        title: true,
        description: true,
      },
    }),
  ]);

  const receivedLots = stockItems.length;
  const cleanReceivedLots = stockItems.filter(
    (row) => !row.temperatureBreach && row.qualityStatus !== "Rejected"
  ).length;
  const cycleCountLines = cycleLines.length;
  const zeroVarianceLines = cycleLines.filter((line) => dec(line.variance) === 0).length;
  const openVariances = cycleLines.filter(
    (line) => dec(line.variance) !== 0 && !line.reason
  ).length;
  const closedVariances = cycleLines.filter(
    (line) => dec(line.variance) !== 0 && Boolean(line.reason)
  ).length;
  const completedGatePasses = gatePasses.filter((pass) => pass.status === "Dispatched");
  const cleanDispatchedGatePasses = completedGatePasses.filter((pass) =>
    pass.lines.every((line) => dec(line.qtyPlanned) === dec(line.qtyDispatched))
  ).length;
  const coldReadingCount = coldReadingRows.length;
  const inSpecColdReadings = coldReadingRows.filter((reading) => {
    const actual = dec(reading.temperatureC);
    const min = dec(reading.location?.temperatureMinC ?? reading.warehouse.temperatureMinC);
    const max = dec(reading.location?.temperatureMaxC ?? reading.warehouse.temperatureMaxC);
    if (reading.temperatureC == null) return false;
    if (reading.location?.temperatureMinC == null && reading.warehouse.temperatureMinC == null && reading.location?.temperatureMaxC == null && reading.warehouse.temperatureMaxC == null) {
      return true;
    }
    return (min === 0 || actual >= min) && (max === 0 || actual <= max);
  }).length;
  const openNcLots = stockItems.filter((row) =>
    ["QualityHold", "Quarantine", "Rejected"].includes(row.qualityStatus)
  ).length;
  const closedNcLots = stockItems.filter((row) =>
    row.qualityStatus === "Released" && Boolean(row.qualityHoldReason)
  ).length;
  const wastageQty = stockItems.reduce((sum, row) => sum + dec(row.qtyWastage) + dec(row.qtyDump), 0);
  const receivedQty = stockItems.reduce((sum, row) => sum + dec(row.qtyReceived), 0);

  const qualityExceptionRows = stockItems.filter((row): row is typeof row & {
    qualityStatus: "QualityHold" | "Quarantine" | "Rejected";
  } => ["QualityHold", "Quarantine", "Rejected"].includes(row.qualityStatus));

  const exceptions: WarehouseSopExceptionRow[] = [
    ...coldTasks
      .filter((task) => task.status !== "Resolved")
      .slice(0, 8)
      .map((task) => ({
        id: task.id,
        type: "Temperature" as const,
        title: task.title,
        detail: task.description ?? task.taskNo,
        ownerRole: "Supervisor / Warehouse Manager",
        severity: task.severity === "Critical" ? ("critical" as const) : ("warning" as const),
        href: "/warehouse",
      })),
    ...qualityExceptionRows
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        type: row.qualityStatus === "QualityHold" ? ("Quality Hold" as const) : row.qualityStatus,
        title: `${row.item}${row.grade ? ` / ${row.grade}` : ""}`,
        detail: `${row.container.containerNo} - ${row.warehouse.name}${row.qualityHoldReason ? ` - ${row.qualityHoldReason}` : ""}`,
        ownerRole: row.qualityStatus === "Rejected" ? "Warehouse Manager" : "Supervisor / QC",
        severity: row.qualityStatus === "Rejected" || row.temperatureBreach ? ("critical" as const) : ("warning" as const),
        href: `/warehouse`,
      })),
    ...cycleLines
      .filter((line) => dec(line.variance) !== 0 && !line.reason)
      .slice(0, 8)
      .map((line) => ({
        id: line.id,
        type: "Variance" as const,
        title: `${line.cycleCount.countNo} variance ${dec(line.variance)}`,
        detail: `${line.stockItem.container.containerNo} - ${line.stockItem.item}${line.stockItem.grade ? ` / ${line.stockItem.grade}` : ""}`,
        ownerRole: "Storekeeper / AWM",
        severity: Math.abs(dec(line.variance)) > 5 ? ("critical" as const) : ("warning" as const),
        href: "/warehouse?tab=processing",
      })),
    ...gatePasses
      .filter((pass) => pass.exceptionReason || pass.lines.some((line) => dec(line.qtyPlanned) !== dec(line.qtyDispatched)))
      .slice(0, 8)
      .map((pass) => ({
        id: pass.id,
        type: "Dispatch" as const,
        title: `${pass.gatePassNo}${pass.salesOrder?.orderNo ? ` / ${pass.salesOrder.orderNo}` : ""}`,
        detail: pass.exceptionReason ?? `Loaded quantity does not match planned quantity`,
        ownerRole: "Billing / Security",
        severity: "warning" as const,
        href: "/warehouse?tab=outward",
      })),
  ].slice(0, 16);

  return {
    kpis: {
      receivingAccuracyPct: pct(cleanReceivedLots, receivedLots),
      inventoryAccuracyPct: pct(zeroVarianceLines, cycleCountLines),
      dispatchAccuracyPct: pct(cleanDispatchedGatePasses, completedGatePasses.length),
      coldChainCompliancePct: pct(inSpecColdReadings, coldReadingCount),
      wastagePct: pct(wastageQty, receivedQty),
      varianceClosurePct: pct(closedVariances, openVariances + closedVariances),
      ncClosurePct: pct(closedNcLots, openNcLots + closedNcLots),
      totals: {
        receivedLots,
        cleanReceivedLots,
        cycleCountLines,
        zeroVarianceLines,
        openVariances,
        closedVariances,
        gatePasses: gatePasses.length,
        cleanDispatchedGatePasses,
        coldReadings: coldReadingCount,
        inSpecColdReadings,
        openNcLots,
        closedNcLots,
        wastageQty,
        receivedQty,
      },
    },
    exceptions,
  };
}
