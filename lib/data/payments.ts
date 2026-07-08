import "server-only";

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
  dueAgeDays: number | null;
}

export interface PaymentSummary {
  totalRequested: number;
  totalPaid: number;
  totalOutstanding: number;
  count: number;
}

export interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

export interface PaymentAgingRow {
  currency: Currency;
  totalOutstanding: number;
  buckets: AgingBucket[];
}

type PaymentWhere = NonNullable<
  Parameters<typeof prisma.payment.findMany>[0]
>["where"];

function buildWhere(
  orgId: string,
  filters: PaymentFilters
): PaymentWhere {
  const where = { orgId, deletedAt: null } as NonNullable<PaymentWhere>;
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

function ageBucketIndex(dueDate: Date | null): number {
  if (!dueDate) return 0;
  const days = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 0;
  if (days <= 30) return 1;
  if (days <= 60) return 2;
  if (days <= 90) return 3;
  return 4;
}

function createBuckets(): AgingBucket[] {
  return [
    { label: "Not yet due", count: 0, amount: 0 },
    { label: "1-30 days", count: 0, amount: 0 },
    { label: "31-60 days", count: 0, amount: 0 },
    { label: "61-90 days", count: 0, amount: 0 },
    { label: "90+ days", count: 0, amount: 0 },
  ];
}

export interface PaymentListOptions {
  /** 1-based page number; when set, results are paginated. */
  page?: number;
  pageSize?: number;
}

export async function countPayments(
  orgId: string,
  filters: PaymentFilters = {}
): Promise<number> {
  return prisma.payment.count({ where: buildWhere(orgId, filters) });
}

export async function listPayments(
  orgId: string,
  filters: PaymentFilters = {},
  options: PaymentListOptions = {}
): Promise<PaymentRow[]> {
  const pagination: { skip?: number; take?: number } = {};
  if (options.page != null) {
    const pageSize = options.pageSize ?? 50;
    pagination.skip = (options.page - 1) * pageSize;
    pagination.take = pageSize;
  }
  const rows = await prisma.payment.findMany({
    where: buildWhere(orgId, filters),
    ...pagination,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      container: { select: { containerNo: true, blNo: true } },
    },
  });

  return rows.map((r: {
    id: string;
    containerId: string;
    supplierName: string | null;
    amountRequested: unknown;
    amountPaid: unknown;
    currency: Currency;
    status: PaymentStatus;
    approvalStatus: ApprovalStatus;
    requestedById: string | null;
    approvedById: string | null;
    requestDate: Date | null;
    dueDate: Date | null;
    paidDate: Date | null;
    reference: string | null;
    container: { containerNo: string; blNo: string } | null;
  }) => {
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
      dueAgeDays: r.dueDate
        ? Math.floor((Date.now() - r.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
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
    .map(
      (g: {
        currency: Currency;
        _sum: {
          amountRequested: unknown;
          amountPaid: unknown;
        };
        _count: number;
      }) => {
      const requested = Number(g._sum.amountRequested ?? 0);
      const paid = Number(g._sum.amountPaid ?? 0);
      return {
        currency: g.currency as Currency,
        totalRequested: requested,
        totalPaid: paid,
        totalOutstanding: Math.max(requested - paid, 0),
        count: g._count,
      };
      }
    )
    .sort(
      (a: CurrencySummary, b: CurrencySummary) =>
        order.indexOf(a.currency) - order.indexOf(b.currency)
    );
}

export async function paymentAgingByCurrency(
  orgId: string,
  filters: PaymentFilters = {}
): Promise<PaymentAgingRow[]> {
  const rows = await listPayments(orgId, filters);
  const currencies: Currency[] = ["USD", "AED", "INR"];
  return currencies
    .map((currency) => {
      const currencyRows = rows.filter(
        (row) => row.currency === currency && row.outstanding > 0
      );
      const buckets = createBuckets();
      for (const row of currencyRows) {
        const idx = ageBucketIndex(row.dueDate ? new Date(row.dueDate) : null);
        buckets[idx].count += 1;
        buckets[idx].amount += row.outstanding;
      }
      return {
        currency,
        totalOutstanding: currencyRows.reduce((sum, row) => sum + row.outstanding, 0),
        buckets,
      };
    })
    .filter((row) => row.totalOutstanding > 0);
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
