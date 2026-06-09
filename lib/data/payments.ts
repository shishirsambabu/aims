import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ApprovalStatus, Currency, PaymentStatus } from "@/types";

export interface PaymentFilters {
  q?: string;
  status?: PaymentStatus;
  containerId?: string;
}

export interface PaymentRow {
  id: string;
  containerId: string;
  containerNo: string | null;
  blNo: string | null;
  supplierName: string | null;
  amountRequested: number;
  amountPaid: number;
  outstanding: number;
  currency: Currency;
  status: PaymentStatus;
  approvalStatus: ApprovalStatus;
  requestedById: string | null;
  approvedById: string | null;
  requestDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  reference: string | null;
}

export interface PaymentSummary {
  totalRequested: number;
  totalPaid: number;
  totalOutstanding: number;
  count: number;
}

function buildWhere(
  orgId: string,
  filters: PaymentFilters
): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = { orgId };
  if (filters.status) where.status = filters.status;
  if (filters.containerId) where.containerId = filters.containerId;
  if (filters.q) {
    where.container = {
      OR: [
        { containerNo: { contains: filters.q, mode: "insensitive" } },
        { blNo: { contains: filters.q, mode: "insensitive" } },
      ],
    };
  }
  return where;
}

export async function listPayments(
  orgId: string,
  filters: PaymentFilters = {}
): Promise<PaymentRow[]> {
  const rows = await prisma.payment.findMany({
    where: buildWhere(orgId, filters),
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      container: { select: { containerNo: true, blNo: true } },
    },
  });

  return rows.map((r) => {
    const requested = Number(r.amountRequested);
    const paid = Number(r.amountPaid);
    return {
      id: r.id,
      containerId: r.containerId,
      containerNo: r.container?.containerNo ?? null,
      blNo: r.container?.blNo ?? null,
      supplierName: r.supplierName,
      amountRequested: requested,
      amountPaid: paid,
      outstanding: Math.max(requested - paid, 0),
      currency: r.currency as Currency,
      status: r.status as PaymentStatus,
      approvalStatus: r.approvalStatus as ApprovalStatus,
      requestedById: r.requestedById,
      approvedById: r.approvedById,
      requestDate: r.requestDate ? r.requestDate.toISOString() : null,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      paidDate: r.paidDate ? r.paidDate.toISOString() : null,
      reference: r.reference,
    };
  });
}

export async function paymentSummary(
  orgId: string,
  filters: PaymentFilters = {}
): Promise<PaymentSummary> {
  const agg = await prisma.payment.aggregate({
    where: buildWhere(orgId, filters),
    _sum: { amountRequested: true, amountPaid: true },
    _count: true,
  });
  const requested = Number(agg._sum.amountRequested ?? 0);
  const paid = Number(agg._sum.amountPaid ?? 0);
  return {
    totalRequested: requested,
    totalPaid: paid,
    totalOutstanding: Math.max(requested - paid, 0),
    count: agg._count,
  };
}

/** Per-currency rollup — USD/AED/INR are never summed together. */
export interface CurrencySummary {
  currency: Currency;
  totalRequested: number;
  totalPaid: number;
  totalOutstanding: number;
  count: number;
}

export async function paymentSummaryByCurrency(
  orgId: string,
  filters: PaymentFilters = {}
): Promise<CurrencySummary[]> {
  const grouped = await prisma.payment.groupBy({
    by: ["currency"],
    where: buildWhere(orgId, filters),
    _sum: { amountRequested: true, amountPaid: true },
    _count: true,
  });
  const order: Currency[] = ["USD", "AED", "INR"];
  return grouped
    .map((g) => {
      const requested = Number(g._sum.amountRequested ?? 0);
      const paid = Number(g._sum.amountPaid ?? 0);
      return {
        currency: g.currency as Currency,
        totalRequested: requested,
        totalPaid: paid,
        totalOutstanding: Math.max(requested - paid, 0),
        count: g._count,
      };
    })
    .sort((a, b) => order.indexOf(a.currency) - order.indexOf(b.currency));
}

/** Derive payment status from amounts. */
export function deriveStatus(
  amountRequested: number,
  amountPaid: number
): PaymentStatus {
  if (amountPaid <= 0) return "Pending";
  if (amountPaid >= amountRequested) return "Paid";
  return "Partial";
}
