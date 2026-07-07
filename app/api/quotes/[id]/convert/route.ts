import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { writeActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPublishedPriceListForWarehouse, normalizeDay } from "@/lib/data/sales";
import { getCustomerCreditExposure } from "@/lib/customer-controls";
import { nextDocumentNumber } from "@/lib/document-sequence";

interface Params {
  params: Promise<{ id: string }>;
}

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "salesorder.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const quote = await prisma.salesQuote.findFirst({
      where: {
        id,
        orgId: session.orgId,
        ...(session.role === "sales_executive"
          ? { customer: { assignedRepId: session.userId } }
          : {}),
      },
      include: {
        customer: true,
        warehouse: true,
        priceList: { include: { items: true } },
        lines: { orderBy: { lineNo: "asc" } },
        revisions: true,
      },
    });
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (quote.approvalStatus !== "Approved") {
      return NextResponse.json({ error: "Approve the quote before converting it" }, { status: 409 });
    }
    if (quote.convertedAt) {
      return NextResponse.json({ error: "Quote already converted" }, { status: 409 });
    }
    if (quote.expiresAt && quote.expiresAt < new Date()) {
      return NextResponse.json({ error: "This quote has expired" }, { status: 409 });
    }
    if (
      quote.customer.approvalStatus !== "Approved" ||
      quote.customer.kycStatus !== "Approved" ||
      quote.customer.creditHold
    ) {
      return NextResponse.json(
        { error: "Customer approval, KYC, or credit status no longer permits conversion" },
        { status: 409 }
      );
    }

    const orderDate = normalizeDay(quote.quoteDate);
    const priceList =
      quote.priceList?.status === "Published"
        ? quote.priceList
        : await getPublishedPriceListForWarehouse(session.orgId, quote.warehouseId, quote.quoteDate);
    if (!priceList) {
      return NextResponse.json({ error: "The quote's published day price is no longer available" }, { status: 409 });
    }

    if (quote.lines.some((line) => !line.stockItemId)) {
      return NextResponse.json({ error: "Assign a released stock lot to every quote line before conversion" }, { status: 409 });
    }

    const stockIds = [...new Set(quote.lines.map((line) => line.stockItemId).filter(Boolean) as string[])];
    const stockItems = stockIds.length
      ? await prisma.stockItem.findMany({
          where: {
            id: { in: stockIds },
            orgId: session.orgId,
            deletedAt: null,
            warehouseId: quote.warehouseId,
            qualityStatus: "Released",
          },
          select: {
            id: true,
            item: true,
            variety: true,
            grade: true,
            uom: true,
            qtyAvailable: true,
            qtyReserved: true,
            qtySold: true,
            containerId: true,
            container: { select: { id: true, containerNo: true, blNo: true, status: true, cost: { select: { totalCost: true } } } },
          },
        })
      : [];
    if (stockItems.length !== stockIds.length) {
      return NextResponse.json({ error: "One or more quote lots are no longer available" }, { status: 409 });
    }

    const exposure = await getCustomerCreditExposure(session.orgId, quote.customerId);
    const creditLimit = quote.customer.creditLimit == null ? null : Number(quote.customer.creditLimit);
    const orderValue = Number(quote.netAmount ?? 0);
    if (creditLimit != null && exposure + orderValue > creditLimit) {
      return NextResponse.json({ error: "Quote conversion exceeds the customer's available credit" }, { status: 409 });
    }

    const dueDate = new Date(orderDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + quote.customer.paymentTermsDays);

    const created = await prisma.$transaction(async (tx) => {
      const day = orderDate.toISOString().slice(0, 10).replaceAll("-", "");
      const orderNo = await nextDocumentNumber(tx, session.orgId, `sales-order:${day}`, `SO-${day}`);
      const reservedAt = new Date();
      const order = await tx.salesOrder.create({
        data: {
          orgId: session.orgId,
          orderNo,
          customerId: quote.customerId,
          warehouseId: quote.warehouseId,
          priceListId: priceList?.id ?? quote.priceListId,
          orderDate,
          dueDate,
          requestedDate: orderDate,
          status: "PendingApproval",
          approvalStatus: "PendingApproval",
          submittedAt: new Date(),
          reservedAt,
          reservationExpiresAt: new Date(reservedAt.getTime() + 2 * 60 * 60 * 1000),
          createdById: session.userId,
          updatedById: session.userId,
          totalQty: quote.lines.reduce((sum, line) => sum + dec(line.qty), 0),
          grossAmount: quote.grossAmount,
          discountAmount: quote.discountAmount,
          netAmount: quote.netAmount,
          notes: quote.notes,
        },
      });

      for (let index = 0; index < quote.lines.length; index += 1) {
        const line = quote.lines[index];
        const stock = stockItems.find((row) => row.id === line.stockItemId);
        if (!stock) throw new Error("STOCK_NOT_FOUND");
        if (dec(stock.qtyAvailable) < dec(line.qty)) throw new Error("INSUFFICIENT_STOCK");

        await tx.salesOrderLine.create({
          data: {
            orgId: session.orgId,
            salesOrderId: order.id,
            stockItemId: stock.id,
            priceListItemId: line.priceListItemId,
            lineNo: index + 1,
            item: line.item,
            variety: line.variety,
            grade: line.grade,
            uom: line.uom,
            qty: line.qty,
            unitPrice: line.unitPrice,
            floorPrice: line.floorPrice,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
            notes: line.notes,
          },
        });

        const reserved = await tx.stockItem.updateMany({
          where: {
            id: stock.id,
            orgId: session.orgId,
            qualityStatus: "Released",
            deletedAt: null,
            qtyAvailable: { gte: dec(line.qty) },
          },
          data: {
            qtyAvailable: { decrement: dec(line.qty) },
            qtyReserved: { increment: dec(line.qty) },
          },
        });
        if (reserved.count !== 1) throw new Error("INSUFFICIENT_STOCK");

        await tx.stockMovement.create({
          data: {
            orgId: session.orgId,
            stockItemId: stock.id,
            kind: "Reserve",
            qty: dec(line.qty),
            uom: line.uom,
            reason: `Converted from quote ${quote.quoteNo}`,
            refType: "SalesQuote",
            refId: quote.id,
            createdById: session.userId,
          },
        });
      }

      await tx.salesOrderRevision.create({
        data: {
          orgId: session.orgId,
          salesOrderId: order.id,
          revisionNo: 1,
          changeType: "converted-from-quote",
          snapshot: { quoteId: quote.id, quoteNo: quote.quoteNo, orderNo },
        },
      });

      const converted = await tx.salesQuote.updateMany({
        where: { id: quote.id, orgId: session.orgId, convertedAt: null, approvalStatus: "Approved" },
        data: {
          convertedAt: new Date(),
          convertedOrderId: order.id,
        },
      });
      if (converted.count !== 1) throw new Error("QUOTE_ALREADY_CONVERTED");

      await tx.salesQuoteRevision.create({
        data: {
          orgId: session.orgId,
          salesQuoteId: quote.id,
          revisionNo: quote.revisions.length + 1,
          changeType: "converted",
          snapshot: {
            quoteNo: quote.quoteNo,
            convertedOrderId: order.id,
            orderNo,
          },
        },
      });

      await writeActivity(tx, {
        orgId: session.orgId,
        userId: session.userId,
        action: "converted_quote_to_order",
        entityType: "sales_quote",
        entityId: quote.id,
        summary: `Converted quote ${quote.quoteNo} to order ${orderNo}`,
        metadata: { quoteId: quote.id, orderId: order.id, orderNo },
      });

      return order;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "STOCK_NOT_FOUND") {
      return NextResponse.json({ error: "One or more quote lots were not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Insufficient stock to convert this quote" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "QUOTE_ALREADY_CONVERTED") {
      return NextResponse.json({ error: "Quote already converted" }, { status: 409 });
    }
    console.error("[api/quotes/:id/convert]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
