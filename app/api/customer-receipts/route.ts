import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { writeActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { postJournalForCustomerReceipt } from "@/lib/data/ledger-posting";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getCustomerLedger,
  listCustomerReceipts,
  listReceivableCustomers,
} from "@/lib/data/receivables";
import { customerReceiptSchema } from "@/lib/validations/receipts";
import { nextDocumentNumber } from "@/lib/document-sequence";
import { enqueueEmail } from "@/lib/email/outbox";
import { reportError } from "@/lib/observability";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "receipts.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");

    if (customerId) {
      const ledger = await getCustomerLedger(session.orgId, customerId);
      if (!ledger) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ data: ledger });
    }

    const [customers, receipts] = await Promise.all([
      listReceivableCustomers(session.orgId),
      listCustomerReceipts(session.orgId),
    ]);
    return NextResponse.json({ data: { customers, receipts } });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "customer-receipts", method: "GET" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "receipt.record")) {
      return NextResponse.json(
        { error: "You do not have permission to record receipts" },
        { status: 403 }
      );
    }

    const parsed = customerReceiptSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, orgId: session.orgId, deletedAt: null },
      select: { id: true, name: true, email: true, approvalStatus: true, kycStatus: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    if (customer.approvalStatus !== "Approved" || customer.kycStatus !== "Approved") {
      return NextResponse.json(
        { error: "Customer must be approved before recording receipts" },
        { status: 409 }
      );
    }

    const orderIds = [...new Set(input.allocations.map((allocation) => allocation.salesOrderId))];
    const orders = await prisma.salesOrder.findMany({
      where: {
        id: { in: orderIds },
        orgId: session.orgId,
        customerId: customer.id,
        approvalStatus: "Approved",
      },
      select: {
        id: true,
        orderNo: true,
        netAmount: true,
        receiptAllocations: {
          select: {
            amount: true,
            receipt: { select: { status: true, deletedAt: true } },
          },
        },
      },
    });
    if (orders.length !== orderIds.length) {
      return NextResponse.json(
        { error: "One or more sales orders were not found for this customer" },
        { status: 404 }
      );
    }

    const openByOrder = new Map(
      orders.map((order) => {
        const paid = order.receiptAllocations.reduce(
          (sum, allocation) =>
            allocation.receipt.status === "Posted" && allocation.receipt.deletedAt == null
              ? sum + Number(allocation.amount)
              : sum,
          0
        );
        return [order.id, Math.max(Number(order.netAmount) - paid, 0)];
      })
    );

    const allocationTotals = new Map<string, number>();
    for (const allocation of input.allocations) {
      allocationTotals.set(
        allocation.salesOrderId,
        (allocationTotals.get(allocation.salesOrderId) ?? 0) + Number(allocation.amount)
      );
    }

    for (const [salesOrderId, amount] of allocationTotals) {
      const remaining = openByOrder.get(salesOrderId) ?? 0;
      if (amount > remaining + 0.01) {
        return NextResponse.json(
          { error: `Allocation exceeds outstanding balance for order ${salesOrderId}` },
          { status: 409 }
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const receiptNo = await nextDocumentNumber(tx, session.orgId, "customer-receipt", "CR", 5);
      const receipt = await tx.customerReceipt.create({
        data: {
          orgId: session.orgId,
          receiptNo,
          customerId: customer.id,
          receiptDate: input.receiptDate ?? new Date(),
          method: input.method,
          currency: input.currency,
          amount: input.amount,
          referenceNo: input.referenceNo ?? null,
          bankName: input.bankName ?? null,
          notes: input.notes ?? null,
          createdById: session.userId,
        },
      });

      for (const allocation of input.allocations) {
        await tx.customerReceiptAllocation.create({
          data: {
            orgId: session.orgId,
            receiptId: receipt.id,
            salesOrderId: allocation.salesOrderId,
            amount: allocation.amount,
            notes: allocation.notes ?? null,
          },
        });
      }

      await writeActivity(tx, {
        orgId: session.orgId,
        userId: session.userId,
        action: "recorded_customer_receipt",
        entityType: "customer_receipt",
        entityId: receipt.id,
        summary: `Recorded receipt ${receiptNo} for ${customer.name}`,
        metadata: { customerId: customer.id, receiptNo, amount: input.amount, allocations: input.allocations.length },
      });

      await postJournalForCustomerReceipt(tx, {
        orgId: session.orgId,
        userId: session.userId,
        receiptId: receipt.id,
        receiptNo,
        receiptDate: input.receiptDate ?? new Date(),
        method: input.method,
        amount: Number(input.amount),
      });

      await enqueueEmail(tx, {
        orgId: session.orgId,
        toEmail: customer.email,
        subject: `AIMS receipt ${receiptNo}`,
        textBody: `Receipt ${receiptNo} has been recorded for ${customer.name}. Amount: ${input.currency} ${Number(input.amount).toFixed(2)}.`,
        htmlBody: `<p>Receipt <strong>${receiptNo}</strong> has been recorded for <strong>${customer.name}</strong>.</p><p>Amount: ${input.currency} ${Number(input.amount).toFixed(2)}</p>`,
        category: "customer_receipt",
      });

      return receipt;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "customer-receipts", method: "POST" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
