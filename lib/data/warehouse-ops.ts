import "server-only";

import { prisma } from "@/lib/prisma";
import type { CycleCountStatus, WarehouseLocationType } from "@/types";

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export interface WarehouseLocationRow {
  id: string;
  warehouseId: string;
  parentId: string | null;
  code: string;
  name: string;
  type: WarehouseLocationType;
  sortOrder: number;
  capacityUnits: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  isActive: boolean;
  notes: string | null;
}

export interface WarehouseCycleCountRow {
  id: string;
  countNo: string;
  warehouseId: string;
  status: CycleCountStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  lineCount: number;
}

export interface WarehouseCycleCountLineRow {
  id: string;
  stockItemId: string;
  locationId: string | null;
  item: string;
  variety: string | null;
  grade: string | null;
  expectedQty: number;
  countedQty: number;
  variance: number;
  reason: string | null;
  notes: string | null;
  stockItem: {
    id: string;
    containerNo: string;
    blNo: string;
    warehouseName: string;
    locationCode: string | null;
  };
}

export interface WarehouseCycleCountDetail extends WarehouseCycleCountRow {
  warehouse: { id: string; name: string; code: string; city: string };
  lines: WarehouseCycleCountLineRow[];
}

export interface DockAppointmentRow {
  id: string;
  appointmentNo: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  containerId: string | null;
  containerNo: string | null;
  blNo: string | null;
  bayCode: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  unloadingStartedAt: string | null;
  unloadingCompletedAt: string | null;
  vehicleNo: string | null;
  driverName: string | null;
  notes: string | null;
}

export interface PutawayRuleRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  product: string;
  variety: string | null;
  ripeningState: string | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  fefoMaxDays: number | null;
  priority: number;
  isActive: boolean;
  notes: string | null;
}

export interface RepackingWorkOrderRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  sourceStockItemId: string;
  sourceLotNo: string | null;
  sourceItem: string;
  sourceGrade: string | null;
  containerNo: string;
  workOrderNo: string;
  outputItem: string;
  outputGrade: string | null;
  packSpec: string | null;
  plannedInputQty: number;
  actualInputQty: number | null;
  outputQty: number | null;
  wastageQty: number | null;
  yieldPct: number | null;
  laborHours: number | null;
  workerCount: number | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

export interface QcSamplingPlanRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  stockItemId: string;
  lotNo: string | null;
  item: string;
  grade: string | null;
  containerNo: string;
  planNo: string;
  sampleSize: number;
  defectClass: string | null;
  defectCount: number;
  severity: string;
  photoRef: string | null;
  disposition: string;
  status: string;
}

export interface ProductivityLogRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  shiftDate: string;
  shiftName: string;
  role: string;
  workerName: string;
  taskType: string;
  qtyHandled: number;
  uom: string;
  hoursWorked: number;
  unitsPerHour: number;
}

export interface ExceptionApprovalRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  refType: string;
  refId: string | null;
  exceptionType: string;
  qty: number | null;
  valueAmount: number | null;
  reason: string;
  status: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export interface SupplierClaimRow {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  containerId: string | null;
  containerNo: string | null;
  blNo: string | null;
  stockItemId: string | null;
  item: string | null;
  grade: string | null;
  claimNo: string;
  claimType: string;
  claimAmount: number | null;
  currency: string;
  wastageQty: number | null;
  qcPhotoRef: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface WarehouseAdvancedOpsRow {
  dockAppointments: DockAppointmentRow[];
  putawayRules: PutawayRuleRow[];
  repackingWorkOrders: RepackingWorkOrderRow[];
  qcSamplingPlans: QcSamplingPlanRow[];
  productivityLogs: ProductivityLogRow[];
  exceptionApprovals: ExceptionApprovalRow[];
  supplierClaims: SupplierClaimRow[];
}

export async function listWarehouseLocations(orgId: string) {
  const rows = await prisma.warehouseLocation.findMany({
    where: { orgId },
    orderBy: [{ warehouseId: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    warehouseId: row.warehouseId,
    parentId: row.parentId,
    code: row.code,
    name: row.name,
    type: row.type as WarehouseLocationType,
    sortOrder: row.sortOrder,
    capacityUnits: dec(row.capacityUnits),
    temperatureMinC: dec(row.temperatureMinC),
    temperatureMaxC: dec(row.temperatureMaxC),
    isActive: row.isActive,
    notes: row.notes,
  }));
}

export async function listWarehouseCycleCounts(orgId: string): Promise<WarehouseCycleCountRow[]> {
  const rows = await prisma.warehouseCycleCount.findMany({
    where: { orgId },
    orderBy: [{ createdAt: "desc" }],
    include: { _count: { select: { lines: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    countNo: row.countNo,
    warehouseId: row.warehouseId,
    status: row.status as CycleCountStatus,
    scheduledAt: iso(row.scheduledAt),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    notes: row.notes,
    lineCount: row._count.lines,
  }));
}

export async function getWarehouseCycleCountById(
  orgId: string,
  id: string
): Promise<WarehouseCycleCountDetail | null> {
  const row = await prisma.warehouseCycleCount.findFirst({
    where: { id, orgId },
    include: {
      warehouse: { select: { id: true, name: true, code: true, city: true } },
      lines: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          stockItem: {
            include: {
              container: { select: { containerNo: true, blNo: true } },
              warehouse: { select: { name: true } },
              location: { select: { code: true } },
            },
          },
          location: { select: { id: true, code: true, name: true } },
        },
      },
      _count: { select: { lines: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    countNo: row.countNo,
    warehouseId: row.warehouseId,
    status: row.status as CycleCountStatus,
    scheduledAt: iso(row.scheduledAt),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    notes: row.notes,
    lineCount: row._count.lines,
    warehouse: row.warehouse,
    lines: row.lines.map((line) => ({
      id: line.id,
      stockItemId: line.stockItemId,
      locationId: line.locationId,
      item: line.stockItem.item,
      variety: line.stockItem.variety,
      grade: line.stockItem.grade,
      expectedQty: dec(line.expectedQty) ?? 0,
      countedQty: dec(line.countedQty) ?? 0,
      variance: dec(line.variance) ?? 0,
      reason: line.reason,
      notes: line.notes,
      stockItem: {
        id: line.stockItem.id,
        containerNo: line.stockItem.container.containerNo,
        blNo: line.stockItem.container.blNo,
        warehouseName: line.stockItem.warehouse.name,
        locationCode: line.location?.code ?? line.stockItem.location?.code ?? null,
      },
    })),
  };
}

export async function listWarehouseAdvancedOps(
  orgId: string
): Promise<WarehouseAdvancedOpsRow> {
  const [
    dockAppointments,
    putawayRules,
    repackingWorkOrders,
    qcSamplingPlans,
    productivityLogs,
    exceptionApprovals,
    supplierClaims,
  ] = await Promise.all([
    prisma.dockAppointment.findMany({
      where: { orgId },
      orderBy: [{ scheduledStart: "asc" }],
      include: {
        warehouse: { select: { name: true, code: true } },
        container: { select: { containerNo: true, blNo: true } },
      },
    }),
    prisma.warehousePutawayRule.findMany({
      where: { orgId },
      orderBy: [{ priority: "asc" }, { product: "asc" }],
      include: {
        warehouse: { select: { name: true } },
        location: { select: { code: true, name: true } },
      },
    }),
    prisma.repackingWorkOrder.findMany({
      where: { orgId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        warehouse: { select: { name: true } },
        sourceStockItem: {
          select: {
            item: true,
            grade: true,
            lotNo: true,
            container: { select: { containerNo: true } },
          },
        },
      },
    }),
    prisma.qcSamplingPlan.findMany({
      where: { orgId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        warehouse: { select: { name: true } },
        stockItem: {
          select: {
            item: true,
            grade: true,
            lotNo: true,
            container: { select: { containerNo: true } },
          },
        },
      },
    }),
    prisma.warehouseProductivityLog.findMany({
      where: { orgId },
      orderBy: [{ shiftDate: "desc" }, { createdAt: "desc" }],
      include: { warehouse: { select: { name: true } } },
      take: 80,
    }),
    prisma.warehouseExceptionApproval.findMany({
      where: { orgId },
      orderBy: [{ createdAt: "desc" }],
      include: { warehouse: { select: { name: true } } },
      take: 80,
    }),
    prisma.supplierClaim.findMany({
      where: { orgId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        supplier: { select: { name: true } },
        container: { select: { containerNo: true, blNo: true } },
        stockItem: { select: { item: true, grade: true } },
      },
      take: 80,
    }),
  ]);

  return {
    dockAppointments: dockAppointments.map((row) => ({
      id: row.id,
      appointmentNo: row.appointmentNo,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse.name,
      warehouseCode: row.warehouse.code,
      containerId: row.containerId,
      containerNo: row.container?.containerNo ?? null,
      blNo: row.container?.blNo ?? null,
      bayCode: row.bayCode,
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd.toISOString(),
      status: row.status,
      unloadingStartedAt: iso(row.unloadingStartedAt),
      unloadingCompletedAt: iso(row.unloadingCompletedAt),
      vehicleNo: row.vehicleNo,
      driverName: row.driverName,
      notes: row.notes,
    })),
    putawayRules: putawayRules.map((row) => ({
      id: row.id,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse.name,
      locationId: row.locationId,
      locationCode: row.location.code,
      locationName: row.location.name,
      product: row.product,
      variety: row.variety,
      ripeningState: row.ripeningState,
      temperatureMinC: dec(row.temperatureMinC),
      temperatureMaxC: dec(row.temperatureMaxC),
      fefoMaxDays: row.fefoMaxDays,
      priority: row.priority,
      isActive: row.isActive,
      notes: row.notes,
    })),
    repackingWorkOrders: repackingWorkOrders.map((row) => {
      const outputQty = dec(row.outputQty);
      const inputQty = dec(row.actualInputQty) ?? dec(row.plannedInputQty);
      return {
        id: row.id,
        warehouseId: row.warehouseId,
        warehouseName: row.warehouse.name,
        sourceStockItemId: row.sourceStockItemId,
        sourceLotNo: row.sourceStockItem.lotNo,
        sourceItem: row.sourceStockItem.item,
        sourceGrade: row.sourceStockItem.grade,
        containerNo: row.sourceStockItem.container.containerNo,
        workOrderNo: row.workOrderNo,
        outputItem: row.outputItem,
        outputGrade: row.outputGrade,
        packSpec: row.packSpec,
        plannedInputQty: dec(row.plannedInputQty) ?? 0,
        actualInputQty: dec(row.actualInputQty),
        outputQty,
        wastageQty: dec(row.wastageQty),
        yieldPct: outputQty != null && inputQty ? Math.round((outputQty / inputQty) * 1000) / 10 : null,
        laborHours: dec(row.laborHours),
        workerCount: row.workerCount,
        status: row.status,
        startedAt: iso(row.startedAt),
        completedAt: iso(row.completedAt),
        notes: row.notes,
      };
    }),
    qcSamplingPlans: qcSamplingPlans.map((row) => ({
      id: row.id,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse.name,
      stockItemId: row.stockItemId,
      lotNo: row.stockItem.lotNo,
      item: row.stockItem.item,
      grade: row.stockItem.grade,
      containerNo: row.stockItem.container.containerNo,
      planNo: row.planNo,
      sampleSize: row.sampleSize,
      defectClass: row.defectClass,
      defectCount: row.defectCount,
      severity: row.severity,
      photoRef: row.photoRef,
      disposition: row.disposition,
      status: row.status,
    })),
    productivityLogs: productivityLogs.map((row) => {
      const qty = dec(row.qtyHandled) ?? 0;
      const hours = dec(row.hoursWorked) ?? 0;
      return {
        id: row.id,
        warehouseId: row.warehouseId,
        warehouseName: row.warehouse.name,
        shiftDate: row.shiftDate.toISOString(),
        shiftName: row.shiftName,
        role: row.role,
        workerName: row.workerName,
        taskType: row.taskType,
        qtyHandled: qty,
        uom: row.uom,
        hoursWorked: hours,
        unitsPerHour: hours > 0 ? Math.round((qty / hours) * 10) / 10 : 0,
      };
    }),
    exceptionApprovals: exceptionApprovals.map((row) => ({
      id: row.id,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse.name,
      refType: row.refType,
      refId: row.refId,
      exceptionType: row.exceptionType,
      qty: dec(row.qty),
      valueAmount: dec(row.valueAmount),
      reason: row.reason,
      status: row.status,
      reviewedAt: iso(row.reviewedAt),
      reviewNotes: row.reviewNotes,
      createdAt: row.createdAt.toISOString(),
    })),
    supplierClaims: supplierClaims.map((row) => ({
      id: row.id,
      supplierId: row.supplierId,
      supplierName: row.supplier?.name ?? null,
      containerId: row.containerId,
      containerNo: row.container?.containerNo ?? null,
      blNo: row.container?.blNo ?? null,
      stockItemId: row.stockItemId,
      item: row.stockItem?.item ?? null,
      grade: row.stockItem?.grade ?? null,
      claimNo: row.claimNo,
      claimType: row.claimType,
      claimAmount: dec(row.claimAmount),
      currency: row.currency,
      wastageQty: dec(row.wastageQty),
      qcPhotoRef: row.qcPhotoRef,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
