import "server-only";

import { daysUntil, expiryLevel } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import type { StockQualityStatus, StockUom } from "@prisma/client";

export interface StockFilters {
  q?: string;
  warehouseId?: string;
}

export interface StockItemRow {
  id: string;
  containerId: string;
  parentStockItemId: string | null;
  containerNo: string;
  blNo: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
  item: string;
  variety: string | null;
  grade: string | null;
  uom: StockUom;
  qtyReceived: number;
  qtyAvailable: number;
  qtyReserved: number;
  qtySold: number;
  qtyWastage: number;
  qtyDump: number;
  perUnitWeightKg: number | null;
  lotNo: string | null;
  palletNo: string | null;
  packDate: string | null;
  expiryDate: string | null;
  bestBeforeDate: string | null;
  storageCondition: string | null;
  ripeningState: string | null;
  qualityStatus: StockQualityStatus;
  temperatureAtReceiptC: number | null;
  temperatureBreach: boolean;
  qualityHoldReason: string | null;
  ageDays: number | null;
  fefoDueInDays: number | null;
  expiryBand: "expired" | "critical" | "warning" | "ok" | "none";
  availableWeightKg: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementRow {
  id: string;
  kind: string;
  qty: number;
  uom: StockUom;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdAt: string;
  createdBy: { fullName: string | null; email: string } | null;
}

export interface WarehouseInwardContainerRow {
  id: string;
  containerNo: string;
  blNo: string;
  item: string | null;
  variety: string | null;
  noOfBoxes: number | null;
  status: string;
  eta: string | null;
  ata: string | null;
  warehouseAssignedAt: string | null;
  warehouseInDate: string | null;
  warehouse: { id: string; name: string; code: string; city: string } | null;
  supplier: { name: string } | null;
}

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function fefoBaseDate(row: {
  expiryDate: Date | null;
  bestBeforeDate: Date | null;
  packDate: Date | null;
  createdAt: Date;
}) {
  return row.expiryDate ?? row.bestBeforeDate ?? row.packDate ?? row.createdAt;
}

function daysSince(value: Date) {
  return Math.max(0, Math.ceil((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24)));
}

function fefoSortKey(row: {
  expiryDate: Date | null;
  bestBeforeDate: Date | null;
  packDate: Date | null;
  createdAt: Date;
}) {
  return fefoBaseDate(row).getTime();
}

export async function listStockItems(
  orgId: string,
  filters: StockFilters = {}
): Promise<StockItemRow[]> {
  const rows = await prisma.stockItem.findMany({
    where: {
      orgId,
      deletedAt: null,
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.q
        ? {
            OR: [
              { item: { contains: filters.q, mode: "insensitive" } },
              { variety: { contains: filters.q, mode: "insensitive" } },
              { grade: { contains: filters.q, mode: "insensitive" } },
              { lotNo: { contains: filters.q, mode: "insensitive" } },
              { palletNo: { contains: filters.q, mode: "insensitive" } },
              {
                container: {
                  is: {
                    OR: [
                      {
                        containerNo: {
                          contains: filters.q,
                          mode: "insensitive",
                        },
                      },
                      { blNo: { contains: filters.q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      parentStockItem: { select: { id: true, lotNo: true, grade: true } },
      container: { select: { containerNo: true, blNo: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      location: { select: { id: true, code: true, name: true } },
    },
  });

  return rows
    .map((row) => {
      const ageDays = daysSince(row.packDate ?? row.createdAt);
      const fefoDate = fefoBaseDate(row);
      const fefoDueInDays = daysUntil(fefoDate);
      const availableWeightKg =
        row.perUnitWeightKg == null
          ? null
          : dec(row.qtyAvailable) * dec(row.perUnitWeightKg);

      return {
        id: row.id,
        containerId: row.containerId,
        parentStockItemId: row.parentStockItem?.id ?? null,
        containerNo: row.container.containerNo,
        blNo: row.container.blNo,
        warehouseId: row.warehouseId,
        warehouseName: row.warehouse.name,
        warehouseCode: row.warehouse.code,
        locationId: row.locationId,
        locationCode: row.location?.code ?? null,
        locationName: row.location?.name ?? null,
        item: row.item,
        variety: row.variety,
        grade: row.grade,
        uom: row.uom as StockUom,
        qtyReceived: dec(row.qtyReceived),
        qtyAvailable: dec(row.qtyAvailable),
        qtyReserved: dec(row.qtyReserved),
        qtySold: dec(row.qtySold),
        qtyWastage: dec(row.qtyWastage),
        qtyDump: dec(row.qtyDump),
        perUnitWeightKg:
          row.perUnitWeightKg == null ? null : Number(row.perUnitWeightKg),
        lotNo: row.lotNo,
        palletNo: row.palletNo,
        packDate: toIso(row.packDate),
        expiryDate: toIso(row.expiryDate),
        bestBeforeDate: toIso(row.bestBeforeDate),
        storageCondition: row.storageCondition,
        ripeningState: row.ripeningState,
        qualityStatus: row.qualityStatus,
        temperatureAtReceiptC:
          row.temperatureAtReceiptC == null ? null : Number(row.temperatureAtReceiptC),
        temperatureBreach: row.temperatureBreach,
        qualityHoldReason: row.qualityHoldReason,
        ageDays: ageDays == null ? null : Math.max(0, ageDays),
        fefoDueInDays,
        expiryBand: expiryLevel(fefoDate),
        availableWeightKg,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => {
      const byFefo =
        fefoSortKey({
        expiryDate: a.expiryDate ? new Date(a.expiryDate) : null,
        bestBeforeDate: a.bestBeforeDate ? new Date(a.bestBeforeDate) : null,
        packDate: a.packDate ? new Date(a.packDate) : null,
        createdAt: new Date(a.createdAt),
      }) -
        fefoSortKey({
          expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
          bestBeforeDate: b.bestBeforeDate ? new Date(b.bestBeforeDate) : null,
          packDate: b.packDate ? new Date(b.packDate) : null,
          createdAt: new Date(b.createdAt),
        });
      if (byFefo !== 0) return byFefo;
      return a.item.localeCompare(b.item);
    });
}

export async function getStockItemById(orgId: string, id: string) {
  return prisma.stockItem.findFirst({
    where: { id, orgId, deletedAt: null },
    include: {
      container: { select: { containerNo: true, blNo: true, status: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      parentStockItem: { select: { id: true, lotNo: true, grade: true } },
    },
  });
}

export async function getEligibleStockContainers(orgId: string) {
  return prisma.container.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: "InWarehouse",
      warehouseId: { not: null },
      stockItems: { none: { deletedAt: null } },
    },
    orderBy: [{ warehouseInDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      containerNo: true,
      blNo: true,
      item: true,
      variety: true,
      noOfBoxes: true,
      warehouse: { select: { name: true, code: true } },
    },
  });
}

export async function listWarehouseInwardContainers(
  orgId: string
): Promise<WarehouseInwardContainerRow[]> {
  const rows = await prisma.container.findMany({
    where: {
      orgId,
      deletedAt: null,
      warehouseId: { not: null },
      stockItems: { none: { deletedAt: null } },
      status: {
        in: [
          "Booked",
          "InTransit",
          "AtPort",
          "CustomsClearance",
          "Cleared",
          "InWarehouse",
        ],
      },
    },
    orderBy: [
      { warehouseAssignedAt: "desc" },
      { eta: "asc" },
      { createdAt: "desc" },
    ],
    include: {
      warehouse: { select: { id: true, name: true, code: true, city: true } },
      supplier: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    containerNo: row.containerNo,
    blNo: row.blNo,
    item: row.item,
    variety: row.variety,
    noOfBoxes: row.noOfBoxes,
    status: row.status,
    eta: toIso(row.eta),
    ata: toIso(row.ata),
    warehouseAssignedAt: toIso(row.warehouseAssignedAt),
    warehouseInDate: toIso(row.warehouseInDate),
    warehouse: row.warehouse,
    supplier: row.supplier,
  }));
}

export async function listStockMovements(orgId: string, stockItemId: string) {
  const rows = await prisma.stockMovement.findMany({
    where: { orgId, stockItemId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdBy: { select: { fullName: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    qty: dec(row.qty),
    uom: row.uom as StockUom,
    reason: row.reason,
    refType: row.refType,
    refId: row.refId,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy
      ? { fullName: row.createdBy.fullName, email: row.createdBy.email }
      : null,
  }));
}
