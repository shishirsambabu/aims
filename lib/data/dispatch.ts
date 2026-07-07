import "server-only";

import { prisma } from "@/lib/prisma";
import type { GatePassStatus } from "@prisma/client";

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

export interface GatePassRow {
  id: string;
  gatePassNo: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  salesOrderId: string | null;
  salesOrderNo: string | null;
  customerName: string | null;
  containerId: string | null;
  containerNo: string | null;
  blNo: string | null;
  stockItemId: string | null;
  status: GatePassStatus;
  vehicleNo: string | null;
  driverName: string | null;
  driverContact: string | null;
  vehicleSealNo: string | null;
  loadingPhotoRef: string | null;
  securityOtp: string | null;
  securityGateOutAt: string | null;
  podRef: string | null;
  podAcknowledgedBy: string | null;
  podAcknowledgedAt: string | null;
  routeName: string | null;
  beatName: string | null;
  deliveryInstructions: string | null;
  returnCratesPlanned: number;
  returnCratesReceived: number;
  returnPalletsPlanned: number;
  returnPalletsReceived: number;
  notes: string | null;
  nextFefoDate: string | null;
  nextFefoDueInDays: number | null;
  totalQty: number;
  dispatchedQty: number;
  remainingQty: number;
  createdAt: string;
  pickedAt: string | null;
  packedAt: string | null;
  readyAt: string | null;
  dispatchedAt: string | null;
  lines: {
    id: string;
    stockItemId: string;
    item: string;
    grade: string | null;
    qtyPlanned: number;
    qtyDispatched: number;
    remainingQty: number;
    uom: string;
    expiryDate: string | null;
    bestBeforeDate: string | null;
    packDate: string | null;
    createdAt: string;
  }[];
}

function fefoKey(
  expiryDate: Date | null,
  bestBeforeDate: Date | null,
  packDate: Date | null,
  createdAt: Date
) {
  return (
    expiryDate?.getTime() ??
    bestBeforeDate?.getTime() ??
    packDate?.getTime() ??
    createdAt.getTime()
  );
}

function daysUntil(value: Date | null): number | null {
  if (!value) return null;
  return Math.ceil((value.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export async function listGatePasses(orgId: string): Promise<GatePassRow[]> {
  const rows = await prisma.gatePass.findMany({
    where: { orgId },
    orderBy: [{ createdAt: "desc" }],
    include: {
    warehouse: { select: { name: true, code: true } },
      salesOrder: { select: { id: true, orderNo: true, customer: { select: { name: true } } } },
      container: { select: { containerNo: true, blNo: true } },
      lines: {
        include: {
          stockItem: {
            select: {
              item: true,
              grade: true,
              expiryDate: true,
              bestBeforeDate: true,
              packDate: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  return rows
    .map((row) => {
    const totalQty = row.lines.reduce((sum, line) => sum + dec(line.qtyPlanned), 0);
    const dispatchedQty = row.lines.reduce((sum, line) => sum + dec(line.qtyDispatched), 0);
    const fefoDates = row.lines
      .map((line) =>
        new Date(
          fefoKey(
            line.stockItem.expiryDate ?? null,
            line.stockItem.bestBeforeDate ?? null,
            line.stockItem.packDate ?? null,
            line.stockItem.createdAt
          )
        )
      )
      .sort((a, b) => a.getTime() - b.getTime());
    const nextFefoDate = fefoDates[0] ?? null;
    return {
      id: row.id,
      gatePassNo: row.gatePassNo,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse.name,
      warehouseCode: row.warehouse.code,
      salesOrderId: row.salesOrderId,
      salesOrderNo: row.salesOrder?.orderNo ?? null,
      customerName: row.salesOrder?.customer.name ?? null,
      containerId: row.containerId,
      containerNo: row.container?.containerNo ?? null,
      blNo: row.container?.blNo ?? null,
      stockItemId: row.stockItemId,
      status: row.status,
      vehicleNo: row.vehicleNo,
      driverName: row.driverName,
      driverContact: row.driverContact,
      vehicleSealNo: row.vehicleSealNo,
      loadingPhotoRef: row.loadingPhotoRef,
      securityOtp: row.securityOtp,
      securityGateOutAt: row.securityGateOutAt?.toISOString() ?? null,
      podRef: row.podRef,
      podAcknowledgedBy: row.podAcknowledgedBy,
      podAcknowledgedAt: row.podAcknowledgedAt?.toISOString() ?? null,
      routeName: row.routeName,
      beatName: row.beatName,
      deliveryInstructions: row.deliveryInstructions,
      returnCratesPlanned: row.returnCratesPlanned,
      returnCratesReceived: row.returnCratesReceived,
      returnPalletsPlanned: row.returnPalletsPlanned,
      returnPalletsReceived: row.returnPalletsReceived,
      notes: row.notes,
      nextFefoDate: nextFefoDate ? nextFefoDate.toISOString() : null,
      nextFefoDueInDays: daysUntil(nextFefoDate),
      totalQty,
      dispatchedQty,
      remainingQty: totalQty - dispatchedQty,
      createdAt: row.createdAt.toISOString(),
      pickedAt: row.pickedAt?.toISOString() ?? null,
      packedAt: row.packedAt?.toISOString() ?? null,
      readyAt: row.readyAt?.toISOString() ?? null,
      dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
      lines: row.lines.map((line) => ({
        id: line.id,
        stockItemId: line.stockItemId,
        item: line.stockItem.item,
        grade: line.stockItem.grade,
        qtyPlanned: dec(line.qtyPlanned),
        qtyDispatched: dec(line.qtyDispatched),
        remainingQty: dec(line.qtyPlanned) - dec(line.qtyDispatched),
        uom: line.uom,
        expiryDate: line.stockItem.expiryDate?.toISOString() ?? null,
        bestBeforeDate: line.stockItem.bestBeforeDate?.toISOString() ?? null,
        packDate: line.stockItem.packDate?.toISOString() ?? null,
        createdAt: line.stockItem.createdAt.toISOString(),
      })),
    };
  })
    .sort((a, b) => {
      const aKey = a.nextFefoDate ? new Date(a.nextFefoDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bKey = b.nextFefoDate ? new Date(b.nextFefoDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (aKey !== bKey) return aKey - bKey;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export async function nextGatePassNo(orgId: string): Promise<string> {
  const count = await prisma.gatePass.count({ where: { orgId } });
  return `GP-${String(count + 1).padStart(5, "0")}`;
}
