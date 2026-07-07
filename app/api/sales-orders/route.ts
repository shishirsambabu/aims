import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { computeProfit } from "@/lib/finance";
import { writeActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildPriceMatchKey,
  getPublishedPriceListForWarehouse,
  listSalesOrders,
  normalizeDay,
} from "@/lib/data/sales";
import { salesOrderSchema } from "@/lib/validations/sales";
import { getCustomerCreditExposure } from "@/lib/customer-controls";
import { nextDocumentNumber } from "@/lib/document-sequence";

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "sales.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const data = await listSalesOrders(
      session.orgId,
      session.role === "sales_executive" ? session.userId : undefined
    );
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/sales-orders]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "salesorder.write")) {
      return NextResponse.json(
        { error: "You do not have permission to create sales orders" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = salesOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const orderDate = normalizeDay(input.orderDate);
    const requestedDate = input.requestedDate ? normalizeDay(input.requestedDate) : null;

    const customer = await prisma.customer.findFirst({
      where: {
        id: input.customerId,
        orgId: session.orgId,
        deletedAt: null,
        ...(session.role === "sales_executive" ? { assignedRepId: session.userId } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        kycStatus: true,
        approvalStatus: true,
        creditHold: true,
        creditLimit: true,
        paymentTermsDays: true,
      },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    if (customer.approvalStatus !== "Approved" || customer.kycStatus !== "Approved") {
      return NextResponse.json(
        { error: "Customer must be approved and KYC cleared before ordering" },
        { status: 409 }
      );
    }
    if (customer.creditHold) {
      return NextResponse.json(
        { error: "Customer is on credit hold" },
        { status: 409 }
      );
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, orgId: session.orgId, deletedAt: null, isActive: true },
      select: { id: true, name: true, code: true, city: true },
    });
    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    const priceList =
      input.priceListId
        ? await prisma.priceList.findFirst({
            where: {
              id: input.priceListId,
              orgId: session.orgId,
              warehouseId: warehouse.id,
              priceDate: orderDate,
              status: "Published",
            },
            include: { items: true },
          })
        : await getPublishedPriceListForWarehouse(session.orgId, warehouse.id, orderDate);

    if (!priceList) {
      return NextResponse.json(
        { error: "Publish a day price for this warehouse before creating orders" },
        { status: 409 }
      );
    }

    const stockIds = [...new Set(input.lines.map((line) => line.stockItemId))];
    const stockItems = await prisma.stockItem.findMany({
      where: {
        id: { in: stockIds },
        orgId: session.orgId,
        deletedAt: null,
        warehouseId: warehouse.id,
        qualityStatus: "Released",
      },
      select: {
        id: true,
        containerId: true,
        item: true,
        variety: true,
        grade: true,
        uom: true,
        qtyAvailable: true,
        qtyReserved: true,
        qtySold: true,
        container: { select: { containerNo: true, blNo: true } },
      },
    });
    if (stockItems.length !== stockIds.length) {
      return NextResponse.json(
        { error: "One or more stock items were not found in the selected warehouse" },
        { status: 404 }
      );
    }

    const priceMap = new Map(
      priceList.items.map((item) => [buildPriceMatchKey(item), item])
    );

    const lineChecks = input.lines.map((line) => {
      const stock = stockItems.find((row) => row.id === line.stockItemId);
      if (!stock) {
        throw new Error("STOCK_NOT_FOUND");
      }
      const qty = Number(line.qty);
      const available = Number(stock.qtyAvailable);
      if (available < qty) {
        throw new Error("INSUFFICIENT_STOCK");
      }
      const priceMatch = priceMap.get(
        buildPriceMatchKey({
          item: stock.item,
          variety: stock.variety,
          grade: stock.grade,
          uom: stock.uom,
        })
      );
      if (!priceMatch) {
        throw new Error("NO_PRICE_FOR_STOCK");
      }
      const unitPrice = Number(line.unitPrice);
      const floorPrice = Number(priceMatch.floorPrice);
      const maxDiscountPct = priceMatch.maxDiscountPct == null ? null : Number(priceMatch.maxDiscountPct);
      const discountAmount = Number(line.discountAmount ?? 0);
      if (discountAmount > qty * unitPrice) {
        throw new Error("INVALID_DISCOUNT");
      }
      const effectiveUnitPrice = qty > 0 ? (qty * unitPrice - discountAmount) / qty : unitPrice;
      const basePrice = Number(priceMatch.basePrice);
      const effectiveDiscountPct = basePrice > 0
        ? ((basePrice - effectiveUnitPrice) / basePrice) * 100
        : 0;
      const exceedsDiscountLimit = maxDiscountPct != null && effectiveDiscountPct > maxDiscountPct + 0.0001;
      const requiresOverride = effectiveUnitPrice < floorPrice || exceedsDiscountLimit;
      if (requiresOverride && !can(session.role, "price.override.approve")) {
        throw new Error(exceedsDiscountLimit ? "DISCOUNT_LIMIT_EXCEEDED" : "PRICE_BELOW_FLOOR");
      }
      if (requiresOverride && !input.pricingOverrideReason) {
        throw new Error("OVERRIDE_REASON_REQUIRED");
      }
      const lineTotal = Math.max(0, qty * unitPrice - discountAmount);
      return {
        stockId: stock.id,
        stock,
        qty,
        unitPrice,
        floorPrice,
        discountAmount,
        effectiveUnitPrice,
        lineTotal,
        priceMatch,
        notes: line.notes ?? null,
      };
    });

    const stockReserveTotals = new Map<string, number>();
    for (const line of lineChecks) {
      stockReserveTotals.set(
        line.stockId,
        (stockReserveTotals.get(line.stockId) ?? 0) + line.qty
      );
    }
    for (const [stockId, qty] of stockReserveTotals.entries()) {
      const stock = stockItems.find((row) => row.id === stockId);
      if (!stock) {
        throw new Error("STOCK_NOT_FOUND");
      }
      if (Number(stock.qtyAvailable) < qty) {
        throw new Error("INSUFFICIENT_STOCK");
      }
    }

    const totalQty = lineChecks.reduce((sum, line) => sum + line.qty, 0);
    const grossAmount = lineChecks.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
    const discountAmount = lineChecks.reduce((sum, line) => sum + line.discountAmount, 0);
    const netAmount = lineChecks.reduce((sum, line) => sum + line.lineTotal, 0);

    const currentExposure = await getCustomerCreditExposure(session.orgId, customer.id);
    const creditLimit = customer.creditLimit == null ? null : Number(customer.creditLimit);
    if (creditLimit != null && currentExposure + netAmount > creditLimit) {
      return NextResponse.json(
        {
          error: "Order exceeds the customer's available credit",
          credit: {
            limit: creditLimit,
            currentExposure,
            orderValue: netAmount,
            shortfall: currentExposure + netAmount - creditLimit,
          },
        },
        { status: 409 }
      );
    }

    const dueDate = new Date(orderDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + customer.paymentTermsDays);

    const created = await prisma.$transaction(async (tx) => {
      const day = orderDate.toISOString().slice(0, 10).replaceAll("-", "");
      const orderNo = await nextDocumentNumber(tx, session.orgId, `sales-order:${day}`, `SO-${day}`);
      const reservedAt = new Date();
      const reservationExpiresAt = new Date(reservedAt.getTime() + 2 * 60 * 60 * 1000);
      const order = await tx.salesOrder.create({
        data: {
          orgId: session.orgId,
          orderNo,
          customerId: customer.id,
          warehouseId: warehouse.id,
          priceListId: priceList.id,
          orderDate,
          dueDate,
          requestedDate: requestedDate ?? undefined,
          status: "PendingApproval",
          approvalStatus: "PendingApproval",
          submittedAt: new Date(),
          reservedAt,
          reservationExpiresAt,
          pricingOverrideReason: input.pricingOverrideReason ?? null,
          createdById: session.userId,
          updatedById: session.userId,
          totalQty,
          grossAmount,
          discountAmount,
          netAmount,
          notes: input.notes ?? null,
        },
      });

      for (let index = 0; index < lineChecks.length; index += 1) {
        const line = lineChecks[index];
        await tx.salesOrderLine.create({
          data: {
            orgId: session.orgId,
            salesOrderId: order.id,
            stockItemId: line.stock.id,
            priceListItemId: line.priceMatch.id,
            lineNo: index + 1,
            item: line.stock.item,
            variety: line.stock.variety,
            grade: line.stock.grade,
            uom: line.stock.uom,
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
            id: line.stock.id,
            orgId: session.orgId,
            qualityStatus: "Released",
            deletedAt: null,
            qtyAvailable: { gte: line.qty },
          },
          data: {
            qtyAvailable: { decrement: line.qty },
            qtyReserved: { increment: line.qty },
          },
        });
        if (reserved.count !== 1) throw new Error("INSUFFICIENT_STOCK");

        await tx.stockMovement.create({
          data: {
            orgId: session.orgId,
            stockItemId: line.stockId,
            kind: "Reserve",
            qty: line.qty,
            uom: line.stock.uom,
            reason: `Reserved for sales order ${orderNo}`,
            refType: "SalesOrder",
            refId: order.id,
            createdById: session.userId,
          },
        });
      }

      await tx.salesOrderRevision.create({
        data: {
          orgId: session.orgId,
          salesOrderId: order.id,
          revisionNo: 1,
          changeType: "created",
          snapshot: {
            orderNo,
            customerId: customer.id,
            warehouseId: warehouse.id,
            priceListId: priceList.id,
            orderDate,
            requestedDate: requestedDate ?? null,
            totalQty,
            grossAmount,
            discountAmount,
            netAmount,
            lines: lineChecks,
          },
        },
      });

      await writeActivity(tx, {
        orgId: session.orgId,
        userId: session.userId,
        action: "submitted_sales_order",
        entityType: "sales_order",
        entityId: order.id,
        summary: `Submitted sales order ${orderNo} for ${customer.name} (${lineChecks.length} lines)`,
        metadata: {
          customerId: customer.id,
          warehouseId: warehouse.id,
          priceListId: priceList.id,
          totalQty,
          grossAmount,
          discountAmount,
          netAmount,
          currentExposure,
          creditLimit,
          reservationExpiresAt: reservationExpiresAt.toISOString(),
          pricingOverrideReason: input.pricingOverrideReason ?? null,
        },
      });

      return order;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ data: created });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (err instanceof Error) {
      if (err.message === "STOCK_NOT_FOUND") {
        return NextResponse.json({ error: "One or more stock items were not found" }, { status: 404 });
      }
      if (err.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json({ error: "Insufficient available stock for one of the selected lots" }, { status: 409 });
      }
      if (err.message === "NO_PRICE_FOR_STOCK") {
        return NextResponse.json({ error: "One or more stock items do not have a matching price list row" }, { status: 409 });
      }
      if (err.message === "PRICE_BELOW_FLOOR") {
        return NextResponse.json({ error: "Unit price cannot go below the floor price" }, { status: 409 });
      }
      if (err.message === "INVALID_DISCOUNT") {
        return NextResponse.json({ error: "Discount cannot exceed the line amount" }, { status: 409 });
      }
      if (err.message === "DISCOUNT_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: "Discount exceeds the published maximum for this price row" }, { status: 409 });
      }
      if (err.message === "OVERRIDE_REASON_REQUIRED") {
        return NextResponse.json({ error: "A pricing override reason is required" }, { status: 422 });
      }
    }
    console.error("[api/sales-orders POST]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
