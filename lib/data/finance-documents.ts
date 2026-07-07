import "server-only";

import { Prisma, type Currency } from "@prisma/client";

import { writeActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/document-sequence";
import { prisma } from "@/lib/prisma";
import type {
  IssueCreditNoteInput,
  IssueSalesInvoiceInput,
  PostSalesReturnInput,
} from "@/lib/validations/finance-documents";

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface SalesInvoiceRow {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  salesOrderId: string | null;
  salesOrderNo: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: string;
  currency: Currency;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  creditedAmount: number;
  lineCount: number;
  notes: string | null;
}

export interface SalesReturnRow {
  id: string;
  returnNo: string;
  customerId: string;
  customerName: string;
  salesOrderId: string | null;
  salesOrderNo: string | null;
  warehouseName: string;
  returnDate: string;
  status: string;
  reason: string;
  lineCount: number;
  creditAmount: number;
  notes: string | null;
}

export interface CreditNoteRow {
  id: string;
  creditNoteNo: string;
  customerId: string;
  customerName: string;
  salesInvoiceId: string | null;
  salesInvoiceNo: string | null;
  salesOrderId: string | null;
  salesOrderNo: string | null;
  creditDate: string;
  status: string;
  currency: Currency;
  amount: number;
  reason: string;
  notes: string | null;
}

export interface FinanceDocumentSummary {
  invoiceValue: number;
  creditValue: number;
  returnValue: number;
  openInvoiceCount: number;
  returnCount: number;
  creditNoteCount: number;
}

export interface FinanceDocumentWorkspaceData {
  summary: FinanceDocumentSummary;
  invoiceReadyOrders: InvoiceReadyOrderRow[];
  returnReadyOrders: InvoiceReadyOrderRow[];
  invoices: SalesInvoiceRow[];
  returns: SalesReturnRow[];
  creditNotes: CreditNoteRow[];
}

export interface InvoiceReadyOrderLineRow {
  id: string;
  item: string;
  variety: string | null;
  grade: string | null;
  uom: string;
  qty: number;
  lineTotal: number;
}

export interface InvoiceReadyOrderRow {
  id: string;
  orderNo: string;
  customerName: string;
  warehouseName: string;
  orderDate: string;
  dueDate: string | null;
  status: string;
  netAmount: number;
  lines: InvoiceReadyOrderLineRow[];
}

export async function getFinanceDocumentWorkspace(
  orgId: string
): Promise<FinanceDocumentWorkspaceData> {
  const [invoiceReadyOrders, returnReadyOrders, invoices, returns, creditNotes] = await Promise.all([
    listInvoiceReadyOrders(orgId),
    listReturnReadyOrders(orgId),
    listSalesInvoices(orgId),
    listSalesReturns(orgId),
    listCreditNotes(orgId),
  ]);

  return {
    summary: {
      invoiceValue: invoices
        .filter((invoice) => invoice.status !== "Cancelled")
        .reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      creditValue: creditNotes
        .filter((note) => note.status !== "Cancelled")
        .reduce((sum, note) => sum + note.amount, 0),
      returnValue: returns
        .filter((row) => row.status === "Posted")
        .reduce((sum, row) => sum + row.creditAmount, 0),
      openInvoiceCount: invoices.filter((invoice) => invoice.status === "Issued").length,
      returnCount: returns.length,
      creditNoteCount: creditNotes.length,
    },
    invoiceReadyOrders,
    returnReadyOrders,
    invoices,
    returns,
    creditNotes,
  };
}

export async function listInvoiceReadyOrders(orgId: string): Promise<InvoiceReadyOrderRow[]> {
  return listDispatchedOrders(orgId, true);
}

export async function listReturnReadyOrders(orgId: string): Promise<InvoiceReadyOrderRow[]> {
  return listDispatchedOrders(orgId, false);
}

async function listDispatchedOrders(
  orgId: string,
  onlyUninvoiced: boolean
): Promise<InvoiceReadyOrderRow[]> {
  const rows = await prisma.salesOrder.findMany({
    where: {
      orgId,
      approvalStatus: "Approved",
      status: { in: ["PartiallyFulfilled", "Fulfilled"] },
      ...(onlyUninvoiced
        ? { salesInvoices: { none: { status: { not: "Cancelled" } } } }
        : {}),
    },
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { name: true } },
      warehouse: { select: { name: true } },
      lines: { orderBy: { lineNo: "asc" } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    orderNo: row.orderNo,
    customerName: row.customer.name,
    warehouseName: row.warehouse.name,
    orderDate: iso(row.orderDate)!,
    dueDate: iso(row.dueDate),
    status: row.status,
    netAmount: dec(row.netAmount),
    lines: row.lines.map((line) => ({
      id: line.id,
      item: line.item,
      variety: line.variety,
      grade: line.grade,
      uom: line.uom,
      qty: dec(line.qty),
      lineTotal: dec(line.lineTotal),
    })),
  }));
}

export async function listSalesInvoices(orgId: string): Promise<SalesInvoiceRow[]> {
  const rows = await prisma.salesInvoice.findMany({
    where: { orgId },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { name: true } },
      salesOrder: { select: { orderNo: true } },
      lines: { select: { id: true } },
      creditNotes: {
        where: { status: { not: "Cancelled" } },
        select: { amount: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    invoiceNo: row.invoiceNo,
    customerId: row.customerId,
    customerName: row.customer.name,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.salesOrder?.orderNo ?? null,
    invoiceDate: iso(row.invoiceDate)!,
    dueDate: iso(row.dueDate),
    status: row.status,
    currency: row.currency,
    taxableAmount: dec(row.taxableAmount),
    taxAmount: dec(row.taxAmount),
    totalAmount: dec(row.totalAmount),
    creditedAmount: row.creditNotes.reduce((sum, note) => sum + dec(note.amount), 0),
    lineCount: row.lines.length,
    notes: row.notes,
  }));
}

export async function listSalesReturns(orgId: string): Promise<SalesReturnRow[]> {
  const rows = await prisma.salesReturn.findMany({
    where: { orgId },
    orderBy: [{ returnDate: "desc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { name: true } },
      salesOrder: { select: { orderNo: true } },
      warehouse: { select: { name: true } },
      lines: { select: { creditAmount: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    returnNo: row.returnNo,
    customerId: row.customerId,
    customerName: row.customer.name,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.salesOrder?.orderNo ?? null,
    warehouseName: row.warehouse.name,
    returnDate: iso(row.returnDate)!,
    status: row.status,
    reason: row.reason,
    lineCount: row.lines.length,
    creditAmount: row.lines.reduce((sum, line) => sum + dec(line.creditAmount), 0),
    notes: row.notes,
  }));
}

export async function listCreditNotes(orgId: string): Promise<CreditNoteRow[]> {
  const rows = await prisma.creditNote.findMany({
    where: { orgId },
    orderBy: [{ creditDate: "desc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { name: true } },
      salesInvoice: { select: { invoiceNo: true } },
      salesOrder: { select: { orderNo: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    creditNoteNo: row.creditNoteNo,
    customerId: row.customerId,
    customerName: row.customer.name,
    salesInvoiceId: row.salesInvoiceId,
    salesInvoiceNo: row.salesInvoice?.invoiceNo ?? null,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.salesOrder?.orderNo ?? null,
    creditDate: iso(row.creditDate)!,
    status: row.status,
    currency: row.currency,
    amount: dec(row.amount),
    reason: row.reason,
    notes: row.notes,
  }));
}

export async function issueSalesInvoice(
  orgId: string,
  userId: string | null,
  input: IssueSalesInvoiceInput
) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: input.salesOrderId, orgId },
    include: {
      customer: { select: { name: true } },
      lines: { orderBy: { lineNo: "asc" } },
      salesInvoices: { where: { status: { not: "Cancelled" } }, select: { id: true, invoiceNo: true } },
    },
  });
  if (!order) throw new FinanceDocumentError("Sales order not found", 404);
  if (order.approvalStatus !== "Approved") {
    throw new FinanceDocumentError("Only approved orders can be invoiced", 409);
  }
  if (!["PartiallyFulfilled", "Fulfilled"].includes(order.status)) {
    throw new FinanceDocumentError("Invoice can be issued only after dispatch starts", 409);
  }
  if (order.salesInvoices.length > 0) {
    throw new FinanceDocumentError(`Order already has invoice ${order.salesInvoices[0].invoiceNo}`, 409);
  }
  if (order.lines.length === 0) {
    throw new FinanceDocumentError("Order has no lines to invoice", 409);
  }

  return prisma.$transaction(async (tx) => {
    const invoiceNo = await nextDocumentNumber(tx, orgId, "sales-invoice", "INV", 5);
    const lineInputs = order.lines.map((line) => {
      const taxableAmount = money(dec(line.lineTotal));
      const taxAmount = money((taxableAmount * Number(input.taxRatePct)) / 100);
      return {
        line,
        taxableAmount,
        taxAmount,
        lineTotal: money(taxableAmount + taxAmount),
      };
    });
    const taxableAmount = money(lineInputs.reduce((sum, line) => sum + line.taxableAmount, 0));
    const taxAmount = money(lineInputs.reduce((sum, line) => sum + line.taxAmount, 0));
    const totalAmount = money(taxableAmount + taxAmount);

    const invoice = await tx.salesInvoice.create({
      data: {
        orgId,
        invoiceNo,
        customerId: order.customerId,
        salesOrderId: order.id,
        invoiceDate: input.invoiceDate ?? new Date(),
        dueDate: input.dueDate ?? order.dueDate,
        status: "Issued",
        currency: "INR",
        taxableAmount,
        taxAmount,
        totalAmount,
        notes: input.notes ?? null,
        createdById: userId,
        lines: {
          create: lineInputs.map(({ line, taxableAmount: lineTaxable, taxAmount: lineTax, lineTotal }) => ({
            orgId,
            salesOrderLineId: line.id,
            stockItemId: line.stockItemId,
            lineNo: line.lineNo,
            item: line.item,
            variety: line.variety,
            grade: line.grade,
            uom: line.uom,
            qty: line.qty,
            unitPrice: line.unitPrice,
            taxableAmount: lineTaxable,
            taxRatePct: input.taxRatePct,
            taxAmount: lineTax,
            lineTotal,
            notes: line.notes,
          })),
        },
      },
    });

    await writeActivity(tx, {
      orgId,
      userId,
      action: "issued_sales_invoice",
      entityType: "sales_invoice",
      entityId: invoice.id,
      summary: `Issued invoice ${invoiceNo} for order ${order.orderNo}`,
      metadata: { salesOrderId: order.id, invoiceNo, totalAmount },
    });

    return invoice;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function issueCreditNote(
  orgId: string,
  userId: string | null,
  input: IssueCreditNoteInput
) {
  let customerId = input.customerId ?? null;
  let salesOrderId = input.salesOrderId ?? null;
  let currency = input.currency;

  if (input.salesInvoiceId) {
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id: input.salesInvoiceId, orgId, status: { not: "Cancelled" } },
      include: { creditNotes: { where: { status: { not: "Cancelled" } }, select: { amount: true } } },
    });
    if (!invoice) throw new FinanceDocumentError("Invoice not found", 404);
    const alreadyCredited = invoice.creditNotes.reduce((sum, note) => sum + dec(note.amount), 0);
    const remaining = dec(invoice.totalAmount) - alreadyCredited;
    if (Number(input.amount) > remaining + 0.01) {
      throw new FinanceDocumentError("Credit note exceeds remaining invoice value", 409);
    }
    customerId = invoice.customerId;
    salesOrderId = invoice.salesOrderId ?? salesOrderId;
    currency = invoice.currency;
  } else if (salesOrderId) {
    const order = await prisma.salesOrder.findFirst({
      where: { id: salesOrderId, orgId },
      select: { customerId: true },
    });
    if (!order) throw new FinanceDocumentError("Sales order not found", 404);
    customerId = order.customerId;
  }

  if (!customerId) throw new FinanceDocumentError("Customer is required", 422);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, orgId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!customer) throw new FinanceDocumentError("Customer not found", 404);

  return prisma.$transaction(async (tx) => {
    const creditNoteNo = await nextDocumentNumber(tx, orgId, "credit-note", "CN", 5);
    const creditNote = await tx.creditNote.create({
      data: {
        orgId,
        creditNoteNo,
        customerId: customer.id,
        salesInvoiceId: input.salesInvoiceId ?? null,
        salesOrderId,
        creditDate: input.creditDate ?? new Date(),
        status: "Issued",
        currency,
        amount: input.amount,
        reason: input.reason,
        notes: input.notes ?? null,
        createdById: userId,
      },
    });

    await writeActivity(tx, {
      orgId,
      userId,
      action: "issued_credit_note",
      entityType: "credit_note",
      entityId: creditNote.id,
      summary: `Issued credit note ${creditNoteNo} for ${customer.name}`,
      metadata: { customerId: customer.id, amount: input.amount, reason: input.reason },
    });

    return creditNote;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function postSalesReturn(
  orgId: string,
  userId: string | null,
  input: PostSalesReturnInput
) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: input.salesOrderId, orgId },
    include: {
      customer: { select: { name: true } },
      lines: true,
      salesReturns: {
        where: { status: "Posted" },
        include: { lines: true },
      },
    },
  });
  if (!order) throw new FinanceDocumentError("Sales order not found", 404);
  if (!["PartiallyFulfilled", "Fulfilled"].includes(order.status)) {
    throw new FinanceDocumentError("Returns can be posted only after dispatch starts", 409);
  }

  const linesById = new Map(order.lines.map((line) => [line.id, line]));
  const returnedByLine = new Map<string, number>();
  for (const postedReturn of order.salesReturns) {
    for (const line of postedReturn.lines) {
      if (!line.salesOrderLineId) continue;
      returnedByLine.set(line.salesOrderLineId, (returnedByLine.get(line.salesOrderLineId) ?? 0) + dec(line.qty));
    }
  }

  for (const inputLine of input.lines) {
    const orderLine = linesById.get(inputLine.salesOrderLineId);
    if (!orderLine) throw new FinanceDocumentError("Return line does not belong to this order", 422);
    const alreadyReturned = returnedByLine.get(orderLine.id) ?? 0;
    const remaining = dec(orderLine.qty) - alreadyReturned;
    if (Number(inputLine.qty) > remaining + 0.001) {
      throw new FinanceDocumentError(`Returned quantity exceeds order balance for ${orderLine.item}`, 409);
    }
  }

  return prisma.$transaction(async (tx) => {
    const returnNo = await nextDocumentNumber(tx, orgId, "sales-return", "SR", 5);
    const salesReturn = await tx.salesReturn.create({
      data: {
        orgId,
        returnNo,
        customerId: order.customerId,
        salesOrderId: order.id,
        warehouseId: order.warehouseId,
        returnDate: input.returnDate ?? new Date(),
        status: "Posted",
        reason: input.reason,
        notes: input.notes ?? null,
        createdById: userId,
        postedAt: new Date(),
      },
    });

    for (const [index, inputLine] of input.lines.entries()) {
      const orderLine = linesById.get(inputLine.salesOrderLineId)!;
      await tx.salesReturnLine.create({
        data: {
          orgId,
          salesReturnId: salesReturn.id,
          salesOrderLineId: orderLine.id,
          stockItemId: orderLine.stockItemId,
          lineNo: index + 1,
          item: orderLine.item,
          variety: orderLine.variety,
          grade: orderLine.grade,
          uom: orderLine.uom,
          qty: inputLine.qty,
          disposition: inputLine.disposition,
          creditAmount: inputLine.creditAmount ?? null,
          reason: inputLine.reason ?? null,
        },
      });

      if (inputLine.disposition === "Restock") {
        const updated = await tx.stockItem.updateMany({
          where: {
            id: orderLine.stockItemId,
            orgId,
            qtySold: { gte: inputLine.qty },
          },
          data: {
            qtyAvailable: { increment: inputLine.qty },
            qtySold: { decrement: inputLine.qty },
          },
        });
        if (updated.count !== 1) {
          throw new FinanceDocumentError(`Could not restock returned item ${orderLine.item}`, 409);
        }
        await tx.stockMovement.create({
          data: {
            orgId,
            stockItemId: orderLine.stockItemId,
            kind: "Adjust",
            qty: inputLine.qty,
            uom: orderLine.uom,
            reason: `Customer return ${returnNo}: ${input.reason}`,
            refType: "sales_return",
            refId: salesReturn.id,
            createdById: userId,
          },
        });
      }
    }

    await writeActivity(tx, {
      orgId,
      userId,
      action: "posted_sales_return",
      entityType: "sales_return",
      entityId: salesReturn.id,
      summary: `Posted return ${returnNo} for order ${order.orderNo}`,
      metadata: { salesOrderId: order.id, returnNo, reason: input.reason, lines: input.lines.length },
    });

    return salesReturn;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelFinanceDocument(
  orgId: string,
  userId: string | null,
  type: "invoice" | "credit-note" | "return",
  id: string,
  reason: string
) {
  return prisma.$transaction(async (tx) => {
    if (type === "invoice") {
      const row = await tx.salesInvoice.findFirst({ where: { id, orgId } });
      if (!row) throw new FinanceDocumentError("Invoice not found", 404);
      if (row.status === "Cancelled") return row;
      const updated = await tx.salesInvoice.update({
        where: { id },
        data: { status: "Cancelled", cancelledAt: new Date(), cancelledById: userId, cancelReason: reason },
      });
      await writeActivity(tx, {
        orgId,
        userId,
        action: "cancelled_sales_invoice",
        entityType: "sales_invoice",
        entityId: id,
        summary: `Cancelled invoice ${row.invoiceNo}`,
        metadata: { reason },
      });
      return updated;
    }

    if (type === "credit-note") {
      const row = await tx.creditNote.findFirst({ where: { id, orgId } });
      if (!row) throw new FinanceDocumentError("Credit note not found", 404);
      if (row.status === "Cancelled") return row;
      const updated = await tx.creditNote.update({
        where: { id },
        data: { status: "Cancelled", cancelledAt: new Date(), cancelledById: userId, cancelReason: reason },
      });
      await writeActivity(tx, {
        orgId,
        userId,
        action: "cancelled_credit_note",
        entityType: "credit_note",
        entityId: id,
        summary: `Cancelled credit note ${row.creditNoteNo}`,
        metadata: { reason },
      });
      return updated;
    }

    const row = await tx.salesReturn.findFirst({ where: { id, orgId }, include: { lines: true } });
    if (!row) throw new FinanceDocumentError("Sales return not found", 404);
    if (row.status === "Cancelled") return row;
    if (row.lines.some((line) => line.disposition === "Restock")) {
      throw new FinanceDocumentError("Restocked returns cannot be cancelled automatically; create a stock adjustment", 409);
    }
    const updated = await tx.salesReturn.update({
      where: { id },
      data: { status: "Cancelled", cancelledAt: new Date(), cancelledById: userId, cancelReason: reason },
    });
    await writeActivity(tx, {
      orgId,
      userId,
      action: "cancelled_sales_return",
      entityType: "sales_return",
      entityId: id,
      summary: `Cancelled return ${row.returnNo}`,
      metadata: { reason },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export class FinanceDocumentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
