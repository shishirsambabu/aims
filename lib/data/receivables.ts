import "server-only";

import { prisma } from "@/lib/prisma";
import type { Currency, ReceiptMethod, CustomerReceiptStatus } from "@/types";

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.max(0, Math.ceil((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

function overdueDays(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function ageBucketIndex(date: Date | null | undefined): number {
  const age = overdueDays(date);
  if (age == null || age <= 0) return 0;
  if (age <= 30) return 1;
  if (age <= 60) return 2;
  if (age <= 90) return 3;
  return 4;
}

function createAgingBuckets(): AgingBucket[] {
  return [
    { label: "Not yet due", count: 0, amount: 0 },
    { label: "1-30 days", count: 0, amount: 0 },
    { label: "31-60 days", count: 0, amount: 0 },
    { label: "61-90 days", count: 0, amount: 0 },
    { label: "90+ days", count: 0, amount: 0 },
  ];
}

function addToAgingBuckets(
  buckets: AgingBucket[],
  dueDate: Date | null | undefined,
  amount: number
) {
  const idx = ageBucketIndex(dueDate);
  buckets[idx].count += 1;
  buckets[idx].amount += amount;
}

export interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

export interface ReceivableCustomerRow {
  id: string;
  code: string;
  name: string;
  tradeName: string | null;
  region: string | null;
  creditLimit: number | null;
  creditHold: boolean;
  kycStatus: string;
  approvalStatus: string;
  orderValue: number;
  receiptValue: number;
  outstanding: number;
  overdue: number;
  orderCount: number;
  receiptCount: number;
  oldestDueDate: string | null;
  oldestAgeDays: number | null;
  agingBuckets: AgingBucket[];
}

export interface CustomerReceivableOrderRow {
  id: string;
  orderNo: string;
  orderDate: string;
  dueDate: string | null;
  netAmount: number;
  receivedAmount: number;
  outstanding: number;
  ageDays: number | null;
  status: string;
  approvalStatus: string;
}

export interface CustomerReceiptRow {
  id: string;
  receiptNo: string;
  customerId: string;
  customerName: string;
  receiptDate: string;
  method: ReceiptMethod;
  currency: Currency;
  amount: number;
  referenceNo: string | null;
  bankName: string | null;
  status: CustomerReceiptStatus;
  allocationCount: number;
  allocationsTotal: number;
  notes: string | null;
  createdAt: string;
}

export interface CustomerLedger {
  customer: {
    id: string;
    code: string;
    name: string;
    tradeName: string | null;
    region: string | null;
    creditLimit: number | null;
    creditHold: boolean;
  };
  summary: {
    orderValue: number;
    receiptValue: number;
    outstanding: number;
    overdue: number;
    oldestDueDate: string | null;
    oldestAgeDays: number | null;
    agingBuckets: AgingBucket[];
  };
  orders: CustomerReceivableOrderRow[];
  receipts: CustomerReceiptRow[];
}

export async function listReceivableCustomers(orgId: string): Promise<ReceivableCustomerRow[]> {
  const customers = await prisma.customer.findMany({
    where: { orgId, deletedAt: null, approvalStatus: "Approved" },
    select: {
      id: true,
      code: true,
      name: true,
      tradeName: true,
      region: true,
      creditLimit: true,
      creditHold: true,
      kycStatus: true,
      approvalStatus: true,
      salesOrders: {
        where: { approvalStatus: "Approved" },
        select: {
          id: true,
          netAmount: true,
          dueDate: true,
          orderDate: true,
          receiptAllocations: {
            select: {
              amount: true,
              receipt: { select: { status: true, deletedAt: true } },
            },
          },
        },
      },
      customerReceipts: {
        where: { status: "Posted" },
        select: {
          id: true,
          amount: true,
          allocations: { select: { amount: true } },
        },
      },
    },
  });

  return customers.map((customer) => {
    const agingBuckets = createAgingBuckets();
    const orderValue = customer.salesOrders.reduce((sum, order) => sum + dec(order.netAmount), 0);
    const receiptValue = customer.customerReceipts.reduce((sum, receipt) => sum + dec(receipt.amount), 0);
    const outstanding = Math.max(orderValue - receiptValue, 0);
    const overdueOrders = customer.salesOrders.filter((order) => {
      const due = order.dueDate ?? order.orderDate;
      const received = order.receiptAllocations.reduce(
        (sum, allocation) =>
          allocation.receipt.status === "Posted" && allocation.receipt.deletedAt == null
            ? sum + dec(allocation.amount)
            : sum,
        0
      );
      const remaining = Math.max(dec(order.netAmount) - received, 0);
      if (remaining > 0) {
        addToAgingBuckets(agingBuckets, due, remaining);
      }
      return remaining > 0 && due.getTime() < Date.now();
    });
    const oldest = overdueOrders
      .map((order) => order.dueDate ?? order.orderDate)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      tradeName: customer.tradeName,
      region: customer.region,
      creditLimit: customer.creditLimit == null ? null : Number(customer.creditLimit),
      creditHold: customer.creditHold,
      kycStatus: customer.kycStatus,
      approvalStatus: customer.approvalStatus,
      orderValue,
      receiptValue,
      outstanding,
      overdue: overdueOrders.reduce(
        (sum, order) =>
          sum +
          Math.max(
            dec(order.netAmount) -
              order.receiptAllocations.reduce((s, a) => s + dec(a.amount), 0),
            0
          ),
        0
      ),
      orderCount: customer.salesOrders.length,
      receiptCount: customer.customerReceipts.length,
      oldestDueDate: iso(oldest),
      oldestAgeDays: daysSince(oldest),
      agingBuckets,
    };
  });
}

export async function getCustomerLedger(orgId: string, customerId: string): Promise<CustomerLedger | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      tradeName: true,
      region: true,
      creditLimit: true,
      creditHold: true,
    },
  });
  if (!customer) return null;

  const [orders, receipts] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { orgId, customerId, approvalStatus: "Approved" },
      orderBy: [{ orderDate: "desc" }],
      select: {
        id: true,
        orderNo: true,
        orderDate: true,
        dueDate: true,
        netAmount: true,
        status: true,
        approvalStatus: true,
        receiptAllocations: {
          select: {
            amount: true,
            receipt: { select: { status: true, deletedAt: true } },
          },
        },
      },
    }),
    prisma.customerReceipt.findMany({
      where: { orgId, customerId, deletedAt: null, status: "Posted" },
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      include: {
        allocations: {
          include: {
            salesOrder: { select: { orderNo: true } },
          },
        },
      },
    }),
  ]);

  const orderRows = orders.map((order) => {
    const receivedAmount = order.receiptAllocations.reduce(
      (sum, allocation) =>
        allocation.receipt.status === "Posted" && allocation.receipt.deletedAt == null
          ? sum + dec(allocation.amount)
          : sum,
      0
    );
    const netAmount = dec(order.netAmount);
    const outstanding = Math.max(netAmount - receivedAmount, 0);
    const due = order.dueDate ?? order.orderDate;
    return {
      id: order.id,
      orderNo: order.orderNo,
      orderDate: iso(order.orderDate)!,
      dueDate: iso(order.dueDate ?? order.orderDate),
      netAmount,
      receivedAmount,
      outstanding,
      ageDays: daysSince(due),
      status: order.status,
      approvalStatus: order.approvalStatus,
    };
  });
  const agingBuckets = createAgingBuckets();
  for (const order of orderRows) {
    if (order.outstanding > 0) {
      addToAgingBuckets(agingBuckets, order.dueDate ? new Date(order.dueDate) : new Date(order.orderDate), order.outstanding);
    }
  }

  const receiptRows = receipts.map((receipt) => ({
    id: receipt.id,
    receiptNo: receipt.receiptNo,
    customerId,
    customerName: customer.name,
    receiptDate: iso(receipt.receiptDate)!,
    method: receipt.method,
    currency: receipt.currency as Currency,
    amount: dec(receipt.amount),
    referenceNo: receipt.referenceNo,
    bankName: receipt.bankName,
    status: receipt.status,
    allocationCount: receipt.allocations.length,
    allocationsTotal: receipt.allocations.reduce((sum, allocation) => sum + dec(allocation.amount), 0),
    notes: receipt.notes,
    createdAt: iso(receipt.createdAt)!,
  }));

  const orderValue = orderRows.reduce((sum, order) => sum + order.netAmount, 0);
  const receiptValue = receiptRows.reduce((sum, receipt) => sum + receipt.amount, 0);
  const outstanding = Math.max(orderValue - receiptValue, 0);
  const overdueOrders = orderRows.filter((order) => {
    if (order.outstanding <= 0) return false;
    return new Date(order.dueDate ?? order.orderDate).getTime() < Date.now();
  });
  const oldestDueDate = orderRows
    .filter((order) => order.outstanding > 0)
    .map((order) => new Date(order.dueDate ?? order.orderDate))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    customer: {
      ...customer,
      creditLimit: customer.creditLimit == null ? null : Number(customer.creditLimit),
    },
    summary: {
      orderValue,
      receiptValue,
      outstanding,
      overdue: overdueOrders.reduce((sum, order) => sum + order.outstanding, 0),
      oldestDueDate: oldestDueDate ? oldestDueDate.toISOString() : null,
      oldestAgeDays: oldestDueDate ? daysSince(new Date(oldestDueDate)) : null,
      agingBuckets,
    },
    orders: orderRows,
    receipts: receiptRows,
  };
}

export async function listCustomerReceipts(orgId: string): Promise<CustomerReceiptRow[]> {
  const rows = await prisma.customerReceipt.findMany({
    where: { orgId, deletedAt: null },
    orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { name: true } },
      allocations: { select: { amount: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    receiptNo: row.receiptNo,
    customerId: row.customerId,
    customerName: row.customer.name,
    receiptDate: row.receiptDate.toISOString(),
    method: row.method as ReceiptMethod,
    currency: row.currency as Currency,
    amount: dec(row.amount),
    referenceNo: row.referenceNo,
    bankName: row.bankName,
    status: row.status as CustomerReceiptStatus,
    allocationCount: row.allocations.length,
    allocationsTotal: row.allocations.reduce((sum, allocation) => sum + dec(allocation.amount), 0),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function nextReceiptNo(orgId: string): Promise<string> {
  const count = await prisma.customerReceipt.count({ where: { orgId } });
  return `CR-${String(count + 1).padStart(5, "0")}`;
}
