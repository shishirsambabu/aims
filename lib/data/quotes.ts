import "server-only";

import { prisma } from "@/lib/prisma";
import type { ApprovalStatus } from "@/types";

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function dayKey(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export interface SalesQuoteRow {
  id: string;
  quoteNo: string;
  customerName: string;
  warehouseName: string;
  quoteDate: string;
  expiresAt: string | null;
  status: ApprovalStatus;
  approvalStatus: ApprovalStatus;
  grossAmount: number | null;
  discountAmount: number | null;
  netAmount: number | null;
  lineCount: number;
  convertedAt: string | null;
}

export interface SalesQuoteLineRow {
  id: string;
  lineNo: number;
  stockItemId: string | null;
  priceListItemId: string | null;
  item: string;
  variety: string | null;
  grade: string | null;
  uom: string;
  qty: number;
  unitPrice: number;
  floorPrice: number;
  discountAmount: number;
  lineTotal: number;
  notes: string | null;
  stockItem: {
    id: string;
    containerNo: string;
    blNo: string;
    warehouseName: string;
    qtyAvailable: number;
  } | null;
}

export interface SalesQuoteRevisionRow {
  id: string;
  revisionNo: number;
  changeType: string;
  note: string | null;
  createdAt: string;
  snapshot: unknown;
}

export interface SalesQuoteDetail {
  id: string;
  quoteNo: string;
  customer: {
    id: string;
    code: string;
    name: string;
    tradeName: string | null;
    creditHold: boolean;
    approvalStatus: string;
    kycStatus: string;
  };
  warehouse: { id: string; name: string; code: string; city: string };
  priceList: { id: string; priceDate: string; status: string } | null;
  quoteDate: string;
  expiresAt: string | null;
  status: ApprovalStatus;
  approvalStatus: ApprovalStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  convertedAt: string | null;
  notes: string | null;
  grossAmount: number | null;
  discountAmount: number | null;
  netAmount: number | null;
  lines: SalesQuoteLineRow[];
  revisions: SalesQuoteRevisionRow[];
}

export async function listSalesQuotes(orgId: string, assignedRepId?: string): Promise<SalesQuoteRow[]> {
  const rows = await prisma.salesQuote.findMany({
    where: { orgId, ...(assignedRepId ? { customer: { assignedRepId } } : {}) },
    orderBy: [{ quoteDate: "desc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { name: true } },
      warehouse: { select: { name: true } },
      _count: { select: { lines: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    quoteNo: row.quoteNo,
    customerName: row.customer.name,
    warehouseName: row.warehouse.name,
    quoteDate: dayKey(row.quoteDate) ?? "",
    expiresAt: dayKey(row.expiresAt),
    status: row.status as ApprovalStatus,
    approvalStatus: row.approvalStatus as ApprovalStatus,
    grossAmount: dec(row.grossAmount),
    discountAmount: dec(row.discountAmount),
    netAmount: dec(row.netAmount),
    lineCount: row._count.lines,
    convertedAt: dayKey(row.convertedAt),
  }));
}

export async function getSalesQuoteById(orgId: string, id: string, assignedRepId?: string): Promise<SalesQuoteDetail | null> {
  const row = await prisma.salesQuote.findFirst({
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
              container: { select: { containerNo: true, blNo: true } },
              warehouse: { select: { name: true } },
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
    quoteNo: row.quoteNo,
    customer: {
      id: row.customer.id,
      code: row.customer.code,
      name: row.customer.name,
      tradeName: row.customer.tradeName,
      creditHold: row.customer.creditHold,
      approvalStatus: row.customer.approvalStatus,
      kycStatus: row.customer.kycStatus,
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
          priceDate: dayKey(row.priceList.priceDate) ?? "",
          status: row.priceList.status,
        }
      : null,
    quoteDate: dayKey(row.quoteDate) ?? "",
    expiresAt: dayKey(row.expiresAt),
    status: row.status as ApprovalStatus,
    approvalStatus: row.approvalStatus as ApprovalStatus,
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    rejectedAt: iso(row.rejectedAt),
    convertedAt: iso(row.convertedAt),
    notes: row.notes,
    grossAmount: dec(row.grossAmount),
    discountAmount: dec(row.discountAmount),
    netAmount: dec(row.netAmount),
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      stockItemId: line.stockItemId,
      priceListItemId: line.priceListItemId,
      item: line.item,
      variety: line.variety,
      grade: line.grade,
      uom: line.uom,
      qty: dec(line.qty) ?? 0,
      unitPrice: dec(line.unitPrice) ?? 0,
      floorPrice: dec(line.floorPrice) ?? 0,
      discountAmount: dec(line.discountAmount) ?? 0,
      lineTotal: dec(line.lineTotal) ?? 0,
      notes: line.notes,
      stockItem: line.stockItem
        ? {
            id: line.stockItem.id,
            containerNo: line.stockItem.container.containerNo,
            blNo: line.stockItem.container.blNo,
            warehouseName: line.stockItem.warehouse.name,
            qtyAvailable: dec(line.stockItem.qtyAvailable) ?? 0,
          }
        : null,
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
