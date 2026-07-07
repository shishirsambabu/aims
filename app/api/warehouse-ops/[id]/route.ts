import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getWarehouseCycleCountById } from "@/lib/data/warehouse-ops";

interface Params {
  params: Promise<{ id: string }>;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "inventory.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const count = await getWarehouseCycleCountById(session.orgId, id);
    if (!count) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: count });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "warehouse.adjust")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
    const existing = await prisma.warehouseCycleCount.findFirst({
      where: { id, orgId: session.orgId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const count = await prisma.warehouseCycleCount.update({
      where: { id: existing.id },
      data: {
        status: body.status ?? undefined,
        startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
        completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
        notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_cycle_count",
      entityType: "warehouse_cycle_count",
      entityId: count.id,
      summary: `Updated cycle count ${count.countNo}`,
      metadata: { after: count },
    });

    return NextResponse.json({ data: count });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "warehouse.adjust") && !can(session.role, "warehouse.receive")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
    const action = normalize(body.action);

    if (action === "add-line") {
      const stockItemId = normalize(body.stockItemId);
      const countedQty = Number(body.countedQty);
      if (!stockItemId || !Number.isFinite(countedQty) || countedQty < 0) {
        return NextResponse.json({ error: "Invalid count line" }, { status: 422 });
      }

      const existing = await prisma.warehouseCycleCount.findFirst({
        where: { id, orgId: session.orgId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
      }
      if (existing.status === "Completed") {
        return NextResponse.json({ error: "Completed cycle counts cannot be changed" }, { status: 409 });
      }

      const stock = await prisma.stockItem.findFirst({
        where: {
          id: stockItemId,
          orgId: session.orgId,
          warehouseId: existing.warehouseId,
          deletedAt: null,
        },
        include: {
          container: { select: { containerNo: true, blNo: true } },
          warehouse: { select: { name: true } },
          location: { select: { id: true, code: true, name: true } },
        },
      });
      if (!stock) {
        return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
      }

      const duplicate = await prisma.warehouseCycleCountLine.count({
        where: { cycleCountId: id, stockItemId: stock.id },
      });
      if (duplicate) {
        return NextResponse.json({ error: "This lot is already included in the cycle count" }, { status: 409 });
      }

      const expectedQty = dec(stock.qtyAvailable) + dec(stock.qtyReserved);
      const variance = countedQty - expectedQty;
      const reason = normalize(body.reason) || null;
      if (variance !== 0 && !reason) {
        return NextResponse.json({ error: "A variance reason is required" }, { status: 422 });
      }
      const line = await prisma.warehouseCycleCountLine.create({
        data: {
          orgId: session.orgId,
          cycleCountId: id,
          stockItemId: stock.id,
          locationId: stock.location?.id ?? null,
          expectedQty,
          countedQty,
          variance,
          reason,
          notes: normalize(body.notes) || null,
        },
      });

      if (existing.status === "Draft") {
        await prisma.warehouseCycleCount.update({
          where: { id },
          data: { status: "InProgress", startedAt: new Date() },
        });
      }

      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "added_cycle_count_line",
        entityType: "warehouse_cycle_count_line",
        entityId: line.id,
        summary: `Added cycle count line for ${stock.container.containerNo}`,
        metadata: { after: line },
      });

      return NextResponse.json({ data: line }, { status: 201 });
    }

    if (action === "post-variance") {
      if (!can(session.role, "warehouse.count.approve")) {
        return NextResponse.json({ error: "A manager must post cycle-count variances" }, { status: 403 });
      }
      const count = await prisma.warehouseCycleCount.findFirst({
        where: { id, orgId: session.orgId },
        include: { lines: true },
      });
      if (!count) {
        return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
      }
      if (count.status === "Completed") {
        return NextResponse.json({ error: "Cycle count already completed" }, { status: 409 });
      }
      if (count.createdById === session.userId) {
        return NextResponse.json(
          { error: "Maker-checker control: the count creator cannot post its variance" },
          { status: 409 }
        );
      }
      if (count.lines.length === 0) {
        return NextResponse.json({ error: "Add at least one count line before posting" }, { status: 409 });
      }

      const affectedStocks = await prisma.stockItem.findMany({
        where: { id: { in: count.lines.map((line) => line.stockItemId) }, orgId: session.orgId },
        select: { id: true, qtyAvailable: true },
      });
      const unsafe = count.lines.find((line) => {
        const stock = affectedStocks.find((row) => row.id === line.stockItemId);
        return stock && dec(stock.qtyAvailable) + dec(line.variance) < 0;
      });
      if (unsafe) {
        return NextResponse.json(
          { error: "Variance would reduce available stock below zero. Release or resolve reservations first." },
          { status: 409 }
        );
      }

      await prisma.$transaction(async (tx) => {
        for (const line of count.lines) {
          const variance = dec(line.variance);
          if (variance === 0) continue;
          const stock = await tx.stockItem.findFirst({
            where: { id: line.stockItemId, orgId: session.orgId, deletedAt: null },
            select: { uom: true },
          });
          const adjusted = await tx.stockItem.updateMany({
            where: {
              id: line.stockItemId,
              orgId: session.orgId,
              qtyAvailable: variance < 0 ? { gte: Math.abs(variance) } : undefined,
            },
            data: {
              qtyAvailable: { increment: variance },
            },
          });
          if (adjusted.count !== 1) throw new Error("COUNT_VARIANCE_CONFLICT");
          await tx.stockMovement.create({
            data: {
              orgId: session.orgId,
              stockItemId: line.stockItemId,
              kind: "Adjust",
              qty: Math.abs(variance),
              uom: stock?.uom ?? "Box",
              reason: `Cycle count variance ${variance > 0 ? "increase" : "decrease"} for ${count.countNo}`,
              refType: "CycleCount",
              refId: count.id,
              createdById: session.userId,
            },
          });
        }

        await tx.warehouseCycleCount.update({
          where: { id: count.id },
          data: { status: "Completed", completedAt: new Date() },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "posted_cycle_count_variance",
        entityType: "warehouse_cycle_count",
        entityId: count.id,
        summary: `Posted variance for cycle count ${count.countNo}`,
      });

      return NextResponse.json({ data: { id, status: "Completed" } });
    }

    return NextResponse.json({ error: "Invalid cycle count action" }, { status: 422 });
  } catch (err) {
    if (err instanceof Error && err.message === "COUNT_VARIANCE_CONFLICT") {
      return NextResponse.json({ error: "Stock changed while posting the count. Recount the affected lot." }, { status: 409 });
    }
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/warehouse-ops/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
