import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { writeActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/document-sequence";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "warehouse.fulfil")) {
      return NextResponse.json(
        { error: "You do not have permission to create gate passes" },
        { status: 403 }
      );
    }

    const order = await prisma.salesOrder.findFirst({
      where: { id, orgId: session.orgId },
      include: {
        customer: { select: { name: true, deliveryInstructions: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            stockItem: {
              select: {
                id: true,
                containerId: true,
                container: { select: { containerNo: true, blNo: true } },
                warehouseId: true,
                item: true,
                grade: true,
                uom: true,
                expiryDate: true,
                bestBeforeDate: true,
                packDate: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (order.approvalStatus !== "Approved") {
      return NextResponse.json(
        { error: "Only approved orders can be sent to fulfilment" },
        { status: 409 }
      );
    }
    if (order.lines.length === 0) {
      return NextResponse.json(
        { error: "This order has no lines to fulfil" },
        { status: 409 }
      );
    }

    const warehouseIds = new Set(order.lines.map((line) => line.stockItem.warehouseId));
    if (warehouseIds.size !== 1 || !warehouseIds.has(order.warehouseId)) {
      return NextResponse.json(
        { error: "Order lines do not all belong to the selected warehouse" },
        { status: 409 }
      );
    }

    const containerIds = new Set(
      order.lines.map((line) => line.stockItem.containerId).filter((value): value is string => !!value)
    );
    const containerId = containerIds.size === 1 ? [...containerIds][0] : null;
    const sortedLines = [...order.lines].sort((a, b) => {
      const aKey = fefoKey(a.stockItem.expiryDate, a.stockItem.bestBeforeDate, a.stockItem.packDate, a.stockItem.createdAt);
      const bKey = fefoKey(b.stockItem.expiryDate, b.stockItem.bestBeforeDate, b.stockItem.packDate, b.stockItem.createdAt);
      if (aKey !== bKey) return aKey - bKey;
      return a.stockItem.item.localeCompare(b.stockItem.item);
    });

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.gatePassLine.groupBy({
        by: ["stockItemId"],
        where: {
          gatePass: {
            salesOrderId: order.id,
            status: { not: "Cancelled" },
          },
        },
        _sum: { qtyPlanned: true },
      });
      const alreadyPlanned = new Map(existing.map((line) => [line.stockItemId, Number(line._sum.qtyPlanned ?? 0)]));
      const remainingLines = sortedLines
        .map((line) => ({ line, qty: Math.max(0, Number(line.qty) - (alreadyPlanned.get(line.stockItemId) ?? 0)) }))
        .filter((entry) => entry.qty > 0);
      if (remainingLines.length === 0) throw new Error("ORDER_ALREADY_RELEASED");

      const gatePassNo = await nextDocumentNumber(tx, session.orgId, "gate-pass", "GP", 5);
      const gatePass = await tx.gatePass.create({
        data: {
          orgId: session.orgId,
          warehouseId: order.warehouseId,
          salesOrderId: order.id,
          containerId,
          gatePassNo,
          status: "Picked",
          pickedAt: new Date(),
          createdById: session.userId,
          deliveryInstructions: order.customer.deliveryInstructions,
          notes: `Created from sales order ${order.orderNo}`,
        },
      });

      for (const { line, qty } of remainingLines) {
        await tx.gatePassLine.create({
          data: {
            orgId: session.orgId,
            gatePassId: gatePass.id,
            stockItemId: line.stockItemId,
            qtyPlanned: qty,
            qtyDispatched: 0,
            uom: line.uom,
          },
        });
      }

      await writeActivity(tx, {
        orgId: session.orgId,
        userId: session.userId,
        action: "sales_order_to_gate_pass",
        entityType: "sales_order",
        entityId: order.id,
        summary: `Created gate pass from sales order ${order.orderNo}`,
        metadata: { gatePassId: gatePass.id, gatePassNo, warehouseId: order.warehouseId, lineCount: remainingLines.length },
      });

      return gatePass;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "ORDER_ALREADY_RELEASED") {
      return NextResponse.json({ error: "All remaining order quantities already have active gate passes" }, { status: 409 });
    }
    console.error("[api/sales-orders/:id/dispatch]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function fefoKey(
  expiryDate: Date | null,
  bestBeforeDate: Date | null,
  packDate: Date | null,
  createdAt: Date
) {
  return (
    expiryDate?.getTime() ??
    bestBeforeDate?.getTime() ??
    packDate?.getTime() ??
    createdAt.getTime()
  );
}
