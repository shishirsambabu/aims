import "server-only";

import { prisma } from "@/lib/prisma";
import { listStockItems, type StockItemRow } from "@/lib/data/stock";
import type { PriceListStatus, SalesOrderStatus, StockUom } from "@/types";

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface PriceListRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  priceDate: string;
  status: PriceListStatus;
  notes: string | null;
  publishedAt: string | null;
  publishedByName: string | null;
  itemCount: number;
}

export interface PriceListItemRow {
  id: string;
  item: string;
  variety: string | null;
  grade: string | null;
  uom: StockUom;
  basePrice: number;
  floorPrice: number;
  benchmarkPrice: number | null;
  maxDiscountPct: number | null;
  notes: string | null;
}

export interface SalesOrderRow {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  priceListId: string | null;
  priceDate: string | null;
  status: SalesOrderStatus;
  approvalStatus: string;
  orderDate: string;
  requestedDate: string | null;
  totalQty: number | null;
  grossAmount: number | null;
  discountAmount: number | null;
  netAmount: number | null;
  lineCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
}

export interface SalesOrderLineRow {
  id: string;
  lineNo: number;
  stockItemId: string;
  priceListItemId: string | null;
  stockItem: {
    id: string;
    containerId: string;
    containerNo: string;
    blNo: string;
    warehouseId: string;
    warehouseName: string;
    item: string;
    variety: string | null;
    grade: string | null;
    uom: StockUom;
    qtyAvailable: number;
    qtyReserved: number;
    qtySold: number;
  };
  item: string;
  variety: string | null;
  grade: string | null;
  uom: StockUom;
  qty: number;
  unitPrice: number;
  floorPrice: number;
  discountAmount: number;
  lineTotal: number;
  notes: string | null;
}

export interface SalesOrderDetail {
  id: string;
  orderNo: string;
  customer: {
    id: string;
    code: string;
    name: string;
    tradeName: string | null;
    gstin: string | null;
    pan: string | null;
    kycStatus: string;
    approvalStatus: string;
    creditLimit: number | null;
    creditHold: boolean;
  };
  warehouse: { id: string; name: string; code: string; city: string };
  priceList: {
    id: string;
    priceDate: string;
    status: PriceListStatus;
  } | null;
  orderDate: string;
  requestedDate: string | null;
  status: SalesOrderStatus;
  approvalStatus: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  reviewNotes: string | null;
  notes: string | null;
  lines: SalesOrderLineRow[];
  revisions: SalesOrderRevisionRow[];
}

export interface SalesOrderRevisionRow {
  id: string;
  revisionNo: number;
  changeType: string;
  note: string | null;
  createdAt: string;
  snapshot: unknown;
}

export interface OrderStockCandidate extends StockItemRow {
  price: {
    id: string | null;
    basePrice: number | null;
    floorPrice: number | null;
    maxDiscountPct: number | null;
    benchmarkPrice: number | null;
  } | null;
}

export async function listPriceLists(orgId: string): Promise<PriceListRow[]> {
  const rows = await prisma.priceList.findMany({
    where: { orgId },
    orderBy: [{ priceDate: "desc" }, { createdAt: "desc" }],
    include: {
      warehouse: { select: { name: true, code: true } },
      publishedBy: { select: { fullName: true, email: true } },
      _count: { select: { items: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    warehouseCode: row.warehouse.code,
    priceDate: dayKey(row.priceDate),
    status: row.status as PriceListStatus,
    notes: row.notes,
    publishedAt: iso(row.publishedAt),
    publishedByName: row.publishedBy?.fullName ?? row.publishedBy?.email ?? null,
    itemCount: row._count.items,
  }));
}

export async function getPriceListById(orgId: string, id: string) {
  return prisma.priceList.findFirst({
    where: { id, orgId },
    include: {
      warehouse: { select: { id: true, name: true, code: true, city: true } },
      publishedBy: { select: { fullName: true, email: true } },
      items: { orderBy: [{ item: "asc" }, { grade: "asc" }] },
    },
  });
}

export async function getPublishedPriceListForWarehouse(
  orgId: string,
  warehouseId: string,
  priceDate: Date
) {
  return prisma.priceList.findFirst({
    where: {
      orgId,
      warehouseId,
      priceDate: dayKey(priceDate) ? new Date(`${dayKey(priceDate)}T00:00:00.000Z`) : priceDate,
      status: "Published",
    },
    include: {
      items: true,
      warehouse: { select: { id: true, name: true, code: true, city: true } },
    },
  });
}

export async function listSalesOrders(orgId: string, assignedRepId?: string): Promise<SalesOrderRow[]> {
  const rows = await prisma.salesOrder.findMany({
    where: { orgId, ...(assignedRepId ? { customer: { assignedRepId } } : {}) },
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true } },
      priceList: { select: { id: true, priceDate: true } },
      _count: { select: { lines: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    orderNo: row.orderNo,
    customerId: row.customerId,
    customerName: row.customer.name,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    priceListId: row.priceListId,
    priceDate: row.priceList?.priceDate ? dayKey(row.priceList.priceDate) : null,
    status: row.status as SalesOrderStatus,
    approvalStatus: row.approvalStatus,
    orderDate: dayKey(row.orderDate),
    requestedDate: row.requestedDate ? dayKey(row.requestedDate) : null,
    totalQty: dec(row.totalQty),
    grossAmount: dec(row.grossAmount),
    discountAmount: dec(row.discountAmount),
    netAmount: dec(row.netAmount),
    lineCount: row._count.lines,
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    rejectedAt: iso(row.rejectedAt),
    notes: row.notes,
  }));
}

export async function getSalesOrderById(orgId: string, id: string, assignedRepId?: string): Promise<SalesOrderDetail | null> {
  const row = await prisma.salesOrder.findFirst({
    where: { id, orgId, ...(assignedRepId ? { customer: { assignedRepId } } : {}) },
    include: {
      customer: true,
      warehouse: true,
      priceList: { select: { id: true, priceDate: true, status: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        include: {
          stockItem: {
            include: {
              container: { select: { id: true, containerNo: true, blNo: true } },
              warehouse: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
      revisions: { orderBy: { revisionNo: "asc" } },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    orderNo: row.orderNo,
    customer: {
      id: row.customer.id,
      code: row.customer.code,
      name: row.customer.name,
      tradeName: row.customer.tradeName,
      gstin: row.customer.gstin,
      pan: row.customer.pan,
      kycStatus: row.customer.kycStatus,
      approvalStatus: row.customer.approvalStatus,
      creditLimit: dec(row.customer.creditLimit),
      creditHold: row.customer.creditHold,
    },
    warehouse: {
      id: row.warehouse.id,
      name: row.warehouse.name,
      code: row.warehouse.code,
      city: row.warehouse.city,
    },
    priceList: row.priceList
      ? {
          id: row.priceList.id,
          priceDate: dayKey(row.priceList.priceDate),
          status: row.priceList.status as PriceListStatus,
        }
      : null,
    orderDate: dayKey(row.orderDate),
    requestedDate: row.requestedDate ? dayKey(row.requestedDate) : null,
    status: row.status as SalesOrderStatus,
    approvalStatus: row.approvalStatus,
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    rejectedAt: iso(row.rejectedAt),
    reviewNotes: row.reviewNotes,
    notes: row.notes,
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      stockItemId: line.stockItemId,
      priceListItemId: line.priceListItemId,
      stockItem: {
        id: line.stockItem.id,
        containerId: line.stockItem.containerId,
        containerNo: line.stockItem.container.containerNo,
        blNo: line.stockItem.container.blNo,
        warehouseId: line.stockItem.warehouseId,
        warehouseName: line.stockItem.warehouse.name,
        item: line.stockItem.item,
        variety: line.stockItem.variety,
        grade: line.stockItem.grade,
        uom: line.stockItem.uom as StockUom,
        qtyAvailable: dec(line.stockItem.qtyAvailable) ?? 0,
        qtyReserved: dec(line.stockItem.qtyReserved) ?? 0,
        qtySold: dec(line.stockItem.qtySold) ?? 0,
      },
      item: line.item,
      variety: line.variety,
      grade: line.grade,
      uom: line.uom as StockUom,
      qty: dec(line.qty) ?? 0,
      unitPrice: dec(line.unitPrice) ?? 0,
      floorPrice: dec(line.floorPrice) ?? 0,
      discountAmount: dec(line.discountAmount) ?? 0,
      lineTotal: dec(line.lineTotal) ?? 0,
      notes: line.notes,
    })),
    revisions: row.revisions.map((revision) => ({
      id: revision.id,
      revisionNo: revision.revisionNo,
      changeType: revision.changeType,
      note: revision.note,
      createdAt: revision.createdAt.toISOString(),
      snapshot: revision.snapshot,
    })),
  };
}

export async function listOrderStockCandidates(
  orgId: string,
  warehouseId?: string,
  priceListId?: string
): Promise<OrderStockCandidate[]> {
  const stockRows = await listStockItems(orgId, warehouseId ? { warehouseId } : {});
  if (!priceListId) {
    return stockRows.map((row) => ({ ...row, price: null }));
  }

  const priceList = await prisma.priceList.findFirst({
    where: { id: priceListId, orgId },
    include: { items: true },
  });
  const prices = priceList?.items ?? [];

  return stockRows.map((row) => {
    const match = prices.find(
      (item) =>
        item.item.toLowerCase() === row.item.toLowerCase() &&
        (item.grade ?? "").toLowerCase() === (row.grade ?? "").toLowerCase() &&
        (item.variety ?? "").toLowerCase() === (row.variety ?? "").toLowerCase() &&
        item.uom === row.uom
    );
    return {
      ...row,
      price: match
        ? {
            id: match.id,
            basePrice: dec(match.basePrice),
            floorPrice: dec(match.floorPrice),
            maxDiscountPct: dec(match.maxDiscountPct),
            benchmarkPrice: dec(match.benchmarkPrice),
          }
        : null,
    };
  });
}

export function normalizeDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function buildPriceMatchKey(row: {
  item: string;
  variety: string | null;
  grade: string | null;
  uom: StockUom;
}) {
  return [
    row.item.trim().toLowerCase(),
    (row.variety ?? "").trim().toLowerCase(),
    (row.grade ?? "").trim().toLowerCase(),
    row.uom,
  ].join("|");
}
