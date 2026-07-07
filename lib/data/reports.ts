import "server-only";

import { prisma } from "@/lib/prisma";
import { listCustomerReceipts, listReceivableCustomers } from "@/lib/data/receivables";

function n(v: unknown): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export interface ReportFilters {
  from?: string;
  to?: string;
}

export interface SupplierRow {
  supplier: string;
  containers: number;
  invoiceValueInr: number;
  totalCost: number;
  saleValue: number;
  profit: number;
  marginPct: number | null;
}

export interface PortRow {
  port: string;
  containers: number;
  saleValue: number;
  profit: number;
}

export interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

export interface ReceivableBucket {
  label: string;
  count: number;
  amount: number;
}

export interface ReceivableRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  region: string | null;
  outstanding: number;
  overdue: number;
  oldestDueDate: string | null;
  oldestAgeDays: number | null;
}

export interface ReceiptRow {
  receiptNo: string;
  customerName: string;
  receiptDate: string;
  method: string;
  currency: string;
  amount: number;
  status: string;
}

export interface ReportData {
  summary: {
    containers: number;
    invoiceValueInr: number;
    totalCost: number;
    saleValue: number;
    profit: number;
    marginPct: number | null;
    outstanding: number;
    arOutstanding: number;
    arOverdue: number;
    receiptValue: number;
    receiptCount: number;
  };
  suppliers: SupplierRow[];
  ports: PortRow[];
  aging: AgingBucket[];
  receivables: ReceivableRow[];
  receivablesAging: ReceivableBucket[];
  recentReceipts: ReceiptRow[];
}

function containerWhere(
  orgId: string,
  filters: ReportFilters
): NonNullable<Parameters<typeof prisma.container.findMany>[0]>["where"] {
  const where = { orgId, deletedAt: null } as NonNullable<
    NonNullable<Parameters<typeof prisma.container.findMany>[0]>["where"]
  >;
  if (filters.from || filters.to) {
    where.eta = {};
    if (filters.from) where.eta.gte = new Date(filters.from);
    if (filters.to) where.eta.lte = new Date(filters.to);
  }
  return where;
}

export async function getReportData(
  orgId: string,
  filters: ReportFilters = {}
): Promise<ReportData> {
  const containers = await prisma.container.findMany({
    where: containerWhere(orgId, filters),
    select: {
      port: true,
      supplier: { select: { name: true } },
      cost: { select: { totalCost: true, beInvoiceValueInr: true } },
      sale: {
        select: { saleValue: true, profit: true, approvalStatus: true },
      },
    },
  });

  // Supplier rollup.
  const supMap = new Map<string, SupplierRow>();
  const portMap = new Map<string, PortRow>();
  let invoiceValueInr = 0;
  let totalCost = 0;
  let saleValue = 0;
  let profit = 0;

  for (const c of containers) {
    const inv = n(c.cost?.beInvoiceValueInr);
    const cost = n(c.cost?.totalCost);
    const approvedSale = c.sale?.approvalStatus === "Approved" ? c.sale : null;
    const sale = n(approvedSale?.saleValue);
    const prof = n(approvedSale?.profit);
    invoiceValueInr += inv;
    totalCost += cost;
    saleValue += sale;
    profit += prof;

    const sName = c.supplier?.name ?? "Unassigned";
    const s = supMap.get(sName) ?? {
      supplier: sName,
      containers: 0,
      invoiceValueInr: 0,
      totalCost: 0,
      saleValue: 0,
      profit: 0,
      marginPct: null,
    };
    s.containers += 1;
    s.invoiceValueInr += inv;
    s.totalCost += cost;
    s.saleValue += sale;
    s.profit += prof;
    supMap.set(sName, s);

    const pName = c.port ?? "Unassigned";
    const p = portMap.get(pName) ?? {
      port: pName,
      containers: 0,
      saleValue: 0,
      profit: 0,
    };
    p.containers += 1;
    p.saleValue += sale;
    p.profit += prof;
    portMap.set(pName, p);
  }

  const suppliers = Array.from(supMap.values())
    .map((s: SupplierRow) => ({
      ...s,
      marginPct: s.saleValue > 0 ? (s.profit / s.saleValue) * 100 : null,
    }))
    .sort((a, b) => b.profit - a.profit);

  const ports = Array.from(portMap.values()).sort((a, b) => b.profit - a.profit);

  // AR/AP aging on outstanding payments.
  const payments = await prisma.payment.findMany({
    where: { orgId, deletedAt: null, status: { not: "Paid" } },
    select: { amountRequested: true, amountPaid: true, dueDate: true },
  });

  const buckets: AgingBucket[] = [
    { label: "Not yet due", count: 0, amount: 0 },
    { label: "1–30 days", count: 0, amount: 0 },
    { label: "31–60 days", count: 0, amount: 0 },
    { label: "61–90 days", count: 0, amount: 0 },
    { label: "90+ days", count: 0, amount: 0 },
  ];
  let outstanding = 0;
  const today = Date.now();
  for (const p of payments) {
    const due = Math.max(n(p.amountRequested) - n(p.amountPaid), 0);
    if (due <= 0) continue;
    outstanding += due;
    let idx = 0;
    if (p.dueDate) {
      const overdueDays = Math.floor(
        (today - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (overdueDays <= 0) idx = 0;
      else if (overdueDays <= 30) idx = 1;
      else if (overdueDays <= 60) idx = 2;
      else if (overdueDays <= 90) idx = 3;
      else idx = 4;
    }
    buckets[idx].count += 1;
    buckets[idx].amount += due;
  }

  const [receivableCustomers, customerReceipts] = await Promise.all([
    listReceivableCustomers(orgId),
    listCustomerReceipts(orgId),
  ]);

  const receivables = receivableCustomers
    .filter((row) => row.outstanding > 0)
    .map((row) => ({
      customerId: row.id,
      customerCode: row.code,
      customerName: row.name,
      region: row.region,
      outstanding: row.outstanding,
      overdue: row.overdue,
      oldestDueDate: row.oldestDueDate,
      oldestAgeDays: row.oldestAgeDays,
    }))
    .sort((a, b) => b.overdue - a.overdue);

  const receivablesAging: ReceivableBucket[] = [
    { label: "Not yet due", count: 0, amount: 0 },
    { label: "1–30 days", count: 0, amount: 0 },
    { label: "31–60 days", count: 0, amount: 0 },
    { label: "61–90 days", count: 0, amount: 0 },
    { label: "90+ days", count: 0, amount: 0 },
  ];
  const now = Date.now();
  for (const row of receivables) {
    const age = row.oldestDueDate ? Math.floor((now - new Date(row.oldestDueDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
    let idx = 0;
    if (age == null || age <= 0) idx = 0;
    else if (age <= 30) idx = 1;
    else if (age <= 60) idx = 2;
    else if (age <= 90) idx = 3;
    else idx = 4;
    receivablesAging[idx].count += 1;
    receivablesAging[idx].amount += row.outstanding;
  }

  const recentReceipts = customerReceipts
    .slice(0, 10)
    .map((receipt) => ({
      receiptNo: receipt.receiptNo,
      customerName: receipt.customerName,
      receiptDate: receipt.receiptDate,
      method: receipt.method,
      currency: receipt.currency,
      amount: receipt.amount,
      status: receipt.status,
    }));
  const receiptValue = customerReceipts.reduce((sum, receipt) => sum + n(receipt.amount), 0);

  return {
    summary: {
      containers: containers.length,
      invoiceValueInr,
      totalCost,
      saleValue,
      profit,
      marginPct: saleValue > 0 ? (profit / saleValue) * 100 : null,
      outstanding,
      arOutstanding: receivableCustomers.reduce((sum, row) => sum + row.outstanding, 0),
      arOverdue: receivableCustomers.reduce((sum, row) => sum + row.overdue, 0),
      receiptValue,
      receiptCount: customerReceipts.length,
    },
    suppliers,
    ports,
    aging: buckets,
    receivables,
    receivablesAging,
    recentReceipts,
  };
}

export async function getContainerPnL(orgId: string, containerId: string) {
  const c = await prisma.container.findFirst({
    where: { id: containerId, orgId, deletedAt: null },
    include: {
      supplier: { select: { name: true } },
      cost: true,
      sale: true,
      shipmentItem: true,
    },
  });
  if (!c) return null;
  return JSON.parse(JSON.stringify(c));
}
