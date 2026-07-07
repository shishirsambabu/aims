import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { logActivity, writeActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildPriceMatchKey, getSalesOrderById } from "@/lib/data/sales";
import { getCustomerCreditExposure } from "@/lib/customer-controls";
import { redactRestrictedFinancialFields } from "@/lib/redaction";
import {
  salesOrderAmendSchema,
  salesOrderReviewSchema,
  type SalesOrderAmendInput,
} from "@/lib/validations/sales";

interface Params {
  params: Promise<{ id: string }>;
}

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function redactedOrder(order: Awaited<ReturnType<typeof getSalesOrderById>>, canViewFloor: boolean) {
  if (!order) return null;
  return {
    ...order,
    lines: order.lines.map((line) => ({
      ...line,
      qty: dec(line.qty),
      unitPrice: dec(line.unitPrice),
      floorPrice: canViewFloor ? dec(line.floorPrice) : null,
      discountAmount: dec(line.discountAmount),
      lineTotal: dec(line.lineTotal),
    })),
    revisions: order.revisions.map((revision) => ({
      ...revision,
      snapshot: canViewFloor
        ? revision.snapshot
        : redactRestrictedFinancialFields(revision.snapshot),
    })),
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "sales.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const order = await getSalesOrderById(
      session.orgId,
      id,
      session.role === "sales_executive" ? session.userId : undefined
    );
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const canViewFloor = can(session.role, "price.floor.view") || can(session.role, "financials.view");
    return NextResponse.json({ data: redactedOrder(order, canViewFloor) });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/sales-orders/:id]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const body = await request.json();
    if (body.action === "amend") {
      if (!can(session.role, "salesorder.write")) {
        return NextResponse.json({ error: "You do not have permission to amend sales orders" }, { status: 403 });
      }
      const amendment = salesOrderAmendSchema.safeParse(body);
      if (!amendment.success) {
        return NextResponse.json({ error: "Validation failed", issues: amendment.error.flatten() }, { status: 422 });
      }
      return await amendSalesOrder(id, session, amendment.data);
    }
    if (!can(session.role, "salesorder.approve")) {
      return NextResponse.json(
        { error: "You do not have permission to review sales orders" },
        { status: 403 }
      );
    }

    const parsed = salesOrderReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const order = await prisma.salesOrder.findFirst({
      where: { id, orgId: session.orgId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            creditHold: true,
            approvalStatus: true,
            kycStatus: true,
            creditLimit: true,
          },
        },
        warehouse: true,
        lines: {
          include: {
            stockItem: {
              include: {
                container: {
                  select: {
                    id: true,
                    containerNo: true,
                    status: true,
                    cost: { select: { totalCost: true } },
                    sale: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (order.status !== "PendingApproval") {
      return NextResponse.json(
        { error: "Only pending orders can be reviewed from here" },
        { status: 409 }
      );
    }

    if (
      (parsed.data.action === "approve" || parsed.data.action === "reject") &&
      order.createdById === session.userId
    ) {
      return NextResponse.json(
        { error: "Maker-checker control: the order creator cannot review their own order" },
        { status: 409 }
      );
    }

    if (
      parsed.data.action === "approve" &&
      order.reservationExpiresAt &&
      order.reservationExpiresAt <= new Date()
    ) {
      return NextResponse.json(
        { error: "This stock reservation has expired. Release and resubmit the order." },
        { status: 409 }
      );
    }

    if (parsed.data.action === "approve") {
      if (order.customer.approvalStatus !== "Approved" || order.customer.kycStatus !== "Approved") {
        return NextResponse.json(
          { error: "Customer must remain approved and KYC cleared before order approval" },
          { status: 409 }
        );
      }
      if (order.customer.creditHold) {
        return NextResponse.json(
          { error: "Customer is currently on credit hold" },
          { status: 409 }
        );
      }

      const exposure = await getCustomerCreditExposure(session.orgId, order.customer.id);
      const creditLimit = order.customer.creditLimit == null ? null : Number(order.customer.creditLimit);
      if (creditLimit != null && exposure > creditLimit) {
        return NextResponse.json(
          {
            error: `Customer exposure ${exposure.toFixed(2)} exceeds credit limit ${creditLimit.toFixed(2)}`,
          },
          { status: 409 }
        );
      }
    }

    const reason = parsed.data.reason?.trim() || null;
    if ((parsed.data.action === "reject" || parsed.data.action === "cancel") && !reason) {
      return NextResponse.json(
        { error: `A ${parsed.data.action} reason is required` },
        { status: 422 }
      );
    }

    const releasedOrder = parsed.data.action !== "approve";

    const updated = await prisma.$transaction(async (tx) => {
      if (releasedOrder) {
        for (const line of order.lines) {
          const released = await tx.stockItem.updateMany({
            where: {
              id: line.stockItemId,
              orgId: session.orgId,
              qtyReserved: { gte: line.qty },
            },
            data: {
              qtyAvailable: { increment: Number(line.qty) },
              qtyReserved: { decrement: Number(line.qty) },
            },
          });
          if (released.count !== 1) throw new Error("RESERVATION_STATE_CONFLICT");
          await tx.stockMovement.create({
            data: {
              orgId: session.orgId,
              stockItemId: line.stockItemId,
              kind: "Release",
              qty: line.qty,
              uom: line.uom,
              reason: `Released from sales order ${order.orderNo}`,
              refType: "SalesOrder",
              refId: order.id,
              createdById: session.userId,
            },
          });
        }
      }

      const next = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status:
            parsed.data.action === "approve"
              ? "Approved"
              : parsed.data.action === "cancel"
                ? "Cancelled"
                : "Rejected",
          approvalStatus: parsed.data.action === "approve" ? "Approved" : "Rejected",
          approvedAt: parsed.data.action === "approve" ? new Date() : undefined,
          rejectedAt: parsed.data.action === "reject" ? new Date() : undefined,
          reviewedById: session.userId,
          reviewNotes: reason,
          reservationExpiresAt: parsed.data.action === "approve" ? null : null,
        },
      });

      const revisionNo =
        (await tx.salesOrderRevision.count({
          where: { orgId: session.orgId, salesOrderId: order.id },
        })) + 1;
      await tx.salesOrderRevision.create({
        data: {
          orgId: session.orgId,
          salesOrderId: order.id,
          revisionNo,
          changeType: parsed.data.action,
          note: reason,
          snapshot: {
            orderNo: next.orderNo,
            status: parsed.data.action === "approve" ? "Approved" : parsed.data.action === "reject" ? "Rejected" : "Cancelled",
            reason,
          },
        },
      });

      await writeActivity(tx, {
        orgId: session.orgId,
        userId: session.userId,
        action:
          parsed.data.action === "approve"
            ? "approved_sales_order"
            : parsed.data.action === "reject"
              ? "rejected_sales_order"
              : "cancelled_sales_order",
        entityType: "sales_order",
        entityId: next.id,
        summary: `${parsed.data.action === "approve" ? "Approved" : parsed.data.action === "reject" ? "Rejected" : "Cancelled"} sales order ${order.orderNo}`,
        metadata: { reason },
      });

      return next;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "NO_PRICE_FOR_STOCK") {
      return NextResponse.json({ error: "Every amended lot must match the order's day-price row" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "PRICE_BELOW_FLOOR") {
      return NextResponse.json({ error: "Effective amended price cannot go below the floor" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Amended quantity exceeds released stock availability" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "RESERVATION_STATE_CONFLICT") {
      return NextResponse.json({ error: "Reservation state changed. Refresh before trying again." }, { status: 409 });
    }
    if (err instanceof Error && err.message === "DISCOUNT_LIMIT_EXCEEDED") {
      return NextResponse.json({ error: "Discount exceeds the published maximum for this price row" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "OVERRIDE_REASON_REQUIRED") {
      return NextResponse.json({ error: "A pricing override reason is required" }, { status: 422 });
    }
    console.error("[api/sales-orders/:id PATCH]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

async function amendSalesOrder(
  id: string,
  session: Awaited<ReturnType<typeof requireSession>>,
  input: SalesOrderAmendInput
) {
  const order = await prisma.salesOrder.findFirst({
    where: {
      id,
      orgId: session.orgId,
      status: "PendingApproval",
      ...(session.role === "sales_executive"
        ? { customer: { assignedRepId: session.userId } }
        : {}),
    },
    include: {
      lines: true,
      priceList: { include: { items: true } },
      customer: { select: { id: true, creditLimit: true, creditHold: true, approvalStatus: true, kycStatus: true } },
    },
  });
  if (!order) {
    return NextResponse.json(
      { error: "Only an accessible pending order can be amended" },
      { status: 404 }
    );
  }
  if (!order.priceList) {
    return NextResponse.json({ error: "The order has no day-price contract" }, { status: 409 });
  }
  if (order.customer.creditHold || order.customer.approvalStatus !== "Approved" || order.customer.kycStatus !== "Approved") {
    return NextResponse.json({ error: "Customer approval, KYC, or credit hold blocks amendment" }, { status: 409 });
  }

  const stockIds = [...new Set(input.lines.map((line) => line.stockItemId))];
  const stockItems = await prisma.stockItem.findMany({
    where: {
      id: { in: stockIds },
      orgId: session.orgId,
      warehouseId: order.warehouseId,
      deletedAt: null,
      qualityStatus: "Released",
    },
  });
  if (stockItems.length !== stockIds.length) {
    return NextResponse.json(
      { error: "One or more amended lots are missing, held, or outside the order warehouse" },
      { status: 409 }
    );
  }

  const oldReserved = new Map<string, number>();
  for (const line of order.lines) {
    oldReserved.set(line.stockItemId, (oldReserved.get(line.stockItemId) ?? 0) + Number(line.qty));
  }
  const requested = new Map<string, number>();
  const checkedLines = input.lines.map((line, index) => {
    const stock = stockItems.find((row) => row.id === line.stockItemId)!;
    const price = order.priceList!.items.find(
      (item) => buildPriceMatchKey(item) === buildPriceMatchKey(stock)
    );
    if (!price) throw new Error("NO_PRICE_FOR_STOCK");
    const qty = Number(line.qty);
    const unitPrice = Number(line.unitPrice);
    const discountAmount = Number(line.discountAmount ?? 0);
    const lineTotal = Math.max(0, qty * unitPrice - discountAmount);
    const effectivePrice = qty > 0 ? lineTotal / qty : unitPrice;
    const basePrice = Number(price.basePrice);
    const effectiveDiscountPct = basePrice > 0 ? ((basePrice - effectivePrice) / basePrice) * 100 : 0;
    const exceedsDiscountLimit = price.maxDiscountPct != null && effectiveDiscountPct > Number(price.maxDiscountPct) + 0.0001;
    const requiresOverride = effectivePrice < Number(price.floorPrice) || exceedsDiscountLimit;
    if (requiresOverride && !can(session.role, "price.override.approve")) {
      throw new Error(exceedsDiscountLimit ? "DISCOUNT_LIMIT_EXCEEDED" : "PRICE_BELOW_FLOOR");
    }
    if (requiresOverride && !input.pricingOverrideReason) {
      throw new Error("OVERRIDE_REASON_REQUIRED");
    }
    requested.set(stock.id, (requested.get(stock.id) ?? 0) + qty);
    return {
      lineNo: index + 1,
      stock,
      price,
      qty,
      unitPrice,
      floorPrice: Number(price.floorPrice),
      discountAmount,
      lineTotal,
      notes: line.notes ?? null,
    };
  });

  for (const [stockId, qty] of requested) {
    const stock = stockItems.find((row) => row.id === stockId)!;
    const availableToOrder = Number(stock.qtyAvailable) + (oldReserved.get(stockId) ?? 0);
    if (qty > availableToOrder) throw new Error("INSUFFICIENT_STOCK");
  }

  const totalQty = checkedLines.reduce((sum, line) => sum + line.qty, 0);
  const grossAmount = checkedLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const discountAmount = checkedLines.reduce((sum, line) => sum + line.discountAmount, 0);
  const netAmount = checkedLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const currentExposure = await getCustomerCreditExposure(session.orgId, order.customerId);
  const projectedExposure = Math.max(currentExposure - Number(order.netAmount ?? 0), 0) + netAmount;
  const creditLimit = order.customer.creditLimit == null ? null : Number(order.customer.creditLimit);
  if (creditLimit != null && projectedExposure > creditLimit) {
    return NextResponse.json({ error: "Amended order exceeds the customer's available credit" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const line of order.lines) {
      const released = await tx.stockItem.updateMany({
        where: { id: line.stockItemId, orgId: session.orgId, qtyReserved: { gte: line.qty } },
        data: {
          qtyAvailable: { increment: Number(line.qty) },
          qtyReserved: { decrement: Number(line.qty) },
        },
      });
      if (released.count !== 1) throw new Error("RESERVATION_STATE_CONFLICT");
      await tx.stockMovement.create({
        data: {
          orgId: session.orgId,
          stockItemId: line.stockItemId,
          kind: "Release",
          qty: line.qty,
          uom: line.uom,
          reason: `Released for amendment of ${order.orderNo}`,
          refType: "SalesOrderAmendment",
          refId: order.id,
          createdById: session.userId,
        },
      });
    }

    await tx.salesOrderLine.deleteMany({ where: { salesOrderId: order.id } });
    for (const line of checkedLines) {
      await tx.salesOrderLine.create({
        data: {
          orgId: session.orgId,
          salesOrderId: order.id,
          stockItemId: line.stock.id,
          priceListItemId: line.price.id,
          lineNo: line.lineNo,
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
          stockItemId: line.stock.id,
          kind: "Reserve",
          qty: line.qty,
          uom: line.stock.uom,
          reason: `Reserved after amendment of ${order.orderNo}`,
          refType: "SalesOrderAmendment",
          refId: order.id,
          createdById: session.userId,
        },
      });
    }

    const next = await tx.salesOrder.update({
      where: { id: order.id },
      data: {
        requestedDate: input.requestedDate ?? order.requestedDate,
        notes: input.notes ?? order.notes,
        totalQty,
        grossAmount,
        discountAmount,
        netAmount,
        updatedById: session.userId,
        reviewedById: null,
        reviewNotes: null,
        pricingOverrideReason: input.pricingOverrideReason ?? null,
      },
    });
    const revisionNo =
      (await tx.salesOrderRevision.count({
        where: { orgId: session.orgId, salesOrderId: order.id },
      })) + 1;
    await tx.salesOrderRevision.create({
      data: {
        orgId: session.orgId,
        salesOrderId: order.id,
        revisionNo,
        changeType: "amended",
        note: input.reason,
        snapshot: {
          orderNo: order.orderNo,
          totalQty,
          grossAmount,
          discountAmount,
          netAmount,
          lines: checkedLines.map((line) => ({
            stockItemId: line.stock.id,
            priceListItemId: line.price.id,
            qty: line.qty,
            unitPrice: line.unitPrice,
            floorPrice: line.floorPrice,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
          })),
        },
      },
    });
    return next;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await logActivity({
    orgId: session.orgId,
    userId: session.userId,
    action: "amended_sales_order",
    entityType: "sales_order",
    entityId: order.id,
    summary: `Amended sales order ${order.orderNo}`,
    metadata: { reason: input.reason, totalQty, netAmount },
  });
  return NextResponse.json({ data: updated });
}
