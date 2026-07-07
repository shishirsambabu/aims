import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  getEligibleStockContainers,
  listStockItems,
} from "@/lib/data/stock";
import {
  receiveStockSchema,
  stockAdjustmentSchema,
  stockQualitySchema,
  stockTransferSchema,
} from "@/lib/validations/stock";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "inventory.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const warehouseId = url.searchParams.get("warehouseId") ?? undefined;

    const [stock, containers] = await Promise.all([
      listStockItems(session.orgId, { q, warehouseId }),
      getEligibleStockContainers(session.orgId),
    ]);

    return NextResponse.json({
      data: stock,
      meta: { containers },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "warehouse.receive")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = receiveStockSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const container = await prisma.container.findFirst({
      where: {
        id: input.containerId,
        orgId: session.orgId,
        deletedAt: null,
      },
      select: {
        id: true,
        containerNo: true,
        blNo: true,
        status: true,
        item: true,
        variety: true,
        warehouseId: true,
        warehouse: { select: { id: true, name: true, code: true } },
        stockItems: { where: { deletedAt: null }, select: { id: true } },
      },
    });

    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }
    if (container.status !== "InWarehouse") {
      return NextResponse.json(
        { error: "Move the container into In Warehouse before receiving stock" },
        { status: 409 }
      );
    }
    if (!container.warehouseId) {
      return NextResponse.json(
        { error: "Assign a warehouse before receiving stock" },
        { status: 409 }
      );
    }
    if (input.warehouseId && input.warehouseId !== container.warehouseId) {
      return NextResponse.json(
        { error: "The selected warehouse does not match the container warehouse" },
        { status: 409 }
      );
    }
    if (container.stockItems.length > 0) {
      return NextResponse.json(
        { error: "This container has already been received into stock" },
        { status: 409 }
      );
    }

    const receiptWarehouseId = input.warehouseId ?? container.warehouseId;
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        id: receiptWarehouseId,
        orgId: session.orgId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, name: true, code: true },
    });
    if (!warehouse) {
      return NextResponse.json(
        { error: "Warehouse not found or inactive" },
        { status: 404 }
      );
    }

    const locationIds = [...new Set([input.locationId, ...input.rows.map((row) => row.locationId)].filter(Boolean) as string[])];
    const locations = await prisma.warehouseLocation.findMany({
      where: {
        orgId: session.orgId,
        warehouseId: warehouse.id,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        temperatureMinC: true,
        temperatureMaxC: true,
      },
    });
    if (locationIds.some((id) => !locations.some((location) => location.id === id))) {
      return NextResponse.json(
        { error: "One or more selected locations were not found in the warehouse" },
        { status: 404 }
      );
    }
    const directedLocation =
      locations.find((location) => location.type === "Bin") ??
      locations.find((location) => location.type === "Zone") ??
      locations.find((location) => location.type === "Room") ??
      null;

    const totalReceived = input.rows.reduce((sum, row) => sum + row.qtyReceived, 0);
    if (totalReceived <= 0) {
      return NextResponse.json(
        { error: "Receipt must include a positive quantity" },
        { status: 422 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const stockRows = [];
      for (const row of input.rows) {
        const assignedLocationId = row.locationId ?? input.locationId ?? directedLocation?.id ?? null;
        const assignedLocation = locations.find((location) => location.id === assignedLocationId) ?? null;
        const receiptTemperature = row.temperatureAtReceiptC ?? null;
        const outsideLocationRange =
          receiptTemperature != null && assignedLocation != null &&
          ((assignedLocation.temperatureMinC != null && receiptTemperature < Number(assignedLocation.temperatureMinC)) ||
            (assignedLocation.temperatureMaxC != null && receiptTemperature > Number(assignedLocation.temperatureMaxC)));
        const temperatureBreach = (row.temperatureBreach ?? false) || outsideLocationRange;
        const stock = await tx.stockItem.create({
          data: {
            orgId: session.orgId,
            containerId: container.id,
            warehouseId: warehouse.id,
            item: row.item.trim(),
            variety: row.variety?.trim() || null,
            grade: row.grade?.trim() || null,
            uom: row.uom,
            qtyReceived: row.qtyReceived,
            qtyAvailable: row.qtyReceived,
            qtyReserved: 0,
            qtySold: 0,
            qtyWastage: 0,
            qtyDump: 0,
            perUnitWeightKg: row.perUnitWeightKg ?? null,
            lotNo: row.lotNo?.trim() || null,
            palletNo: row.palletNo?.trim() || null,
            packDate: row.packDate ?? null,
            expiryDate: row.expiryDate ?? null,
            bestBeforeDate: row.bestBeforeDate ?? null,
            storageCondition: row.storageCondition?.trim() || null,
            ripeningState: row.ripeningState?.trim() || null,
            qualityStatus: temperatureBreach
              ? "Quarantine"
              : row.qualityStatus ?? "Released",
            temperatureAtReceiptC: receiptTemperature,
            temperatureBreach,
            qualityHoldReason:
              row.qualityHoldReason?.trim() ||
              (temperatureBreach ? "Temperature outside the assigned location range at receipt" : null),
            locationId: assignedLocationId,
          },
        });

        await tx.stockMovement.create({
          data: {
            orgId: session.orgId,
            stockItemId: stock.id,
            kind: "Receive",
            qty: row.qtyReceived,
            uom: row.uom,
            reason:
              row.lotNo || row.palletNo
                ? `Receive lot ${row.lotNo ?? row.palletNo ?? stock.id}`
                : `Received from container ${container.containerNo}`,
            refType: "container",
            refId: container.id,
            createdById: session.userId,
          },
        });

        stockRows.push(stock);
      }
      return stockRows;
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "stock_received",
      entityType: "stock",
      entityId: container.id,
      summary: `Received ${created.length} stock line${created.length === 1 ? "" : "s"} from ${container.containerNo}`,
      metadata: {
        containerId: container.id,
        containerNo: container.containerNo,
        blNo: container.blNo,
        warehouseId: warehouse.id,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        totalReceived,
        lines: input.rows.length,
      },
    });

    const payload = await listStockItems(session.orgId, { warehouseId: warehouse.id });
    return NextResponse.json(
      {
        data: {
          created,
          stock: payload,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "warehouse.adjust")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
    if (body.action === "quality") {
      const quality = stockQualitySchema.safeParse(body);
      if (!quality.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: quality.error.flatten() },
          { status: 422 }
        );
      }
      const existing = await prisma.stockItem.findFirst({
        where: { id: quality.data.stockItemId, orgId: session.orgId, deletedAt: null },
        select: { id: true, item: true, qualityStatus: true, temperatureBreach: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
      }
      const updated = await prisma.stockItem.update({
        where: { id: existing.id },
        data: {
          qualityStatus: quality.data.qualityStatus,
          qualityHoldReason: quality.data.reason,
          qualityReviewedAt: new Date(),
          qualityReviewedById: session.userId,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "stock_quality_status_changed",
        entityType: "stock",
        entityId: existing.id,
        summary: `${existing.item}: ${existing.qualityStatus} to ${quality.data.qualityStatus}`,
        metadata: {
          before: { qualityStatus: existing.qualityStatus },
          after: { qualityStatus: quality.data.qualityStatus },
          reason: quality.data.reason,
          temperatureBreach: existing.temperatureBreach,
        },
      });
      return NextResponse.json({ data: updated });
    }

    if (body.action === "transfer") {
      const transfer = stockTransferSchema.safeParse(body);
      if (!transfer.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: transfer.error.flatten() },
          { status: 422 }
        );
      }

      const stockItem = await prisma.stockItem.findFirst({
        where: { id: transfer.data.stockItemId, orgId: session.orgId, deletedAt: null },
        select: {
          id: true,
          containerId: true,
          item: true,
          uom: true,
          warehouseId: true,
          locationId: true,
          qtyReceived: true,
          qtyAvailable: true,
          qtyReserved: true,
          location: { select: { code: true, name: true } },
        },
      });
      if (!stockItem) {
        return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
      }

      const destination = await prisma.warehouseLocation.findFirst({
        where: {
          id: transfer.data.locationId,
          orgId: session.orgId,
          warehouseId: stockItem.warehouseId,
          isActive: true,
        },
        select: { id: true, code: true, name: true },
      });
      if (!destination) {
        return NextResponse.json(
          { error: "Destination location is not active in this warehouse" },
          { status: 404 }
        );
      }
      if (destination.id === stockItem.locationId) {
        return NextResponse.json(
          { error: "Choose a different destination location" },
          { status: 409 }
        );
      }

      const movedQty =
        Number(stockItem.qtyAvailable) + Number(stockItem.qtyReserved) > 0
          ? Number(stockItem.qtyAvailable) + Number(stockItem.qtyReserved)
          : Number(stockItem.qtyReceived);
      const sourceLabel = stockItem.location
        ? `${stockItem.location.code} - ${stockItem.location.name}`
        : "Unassigned";
      const destinationLabel = `${destination.code} - ${destination.name}`;

      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { locationId: destination.id },
        });
        await tx.stockMovement.create({
          data: {
            orgId: session.orgId,
            stockItemId: stockItem.id,
            kind: "Adjust",
            qty: movedQty > 0 ? movedQty : 0.001,
            uom: stockItem.uom,
            reason: `Location transfer: ${sourceLabel} to ${destinationLabel}. ${transfer.data.reason}`,
            refType: "WarehouseTransfer",
            refId: destination.id,
            createdById: session.userId,
          },
        });
        return next;
      });

      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "stock_transfer_location",
        entityType: "stock",
        entityId: stockItem.id,
        summary: `${stockItem.item} moved from ${sourceLabel} to ${destinationLabel}`,
        metadata: {
          stockItemId: stockItem.id,
          containerId: stockItem.containerId,
          fromLocationId: stockItem.locationId,
          toLocationId: destination.id,
          reason: transfer.data.reason,
        },
      });

      return NextResponse.json({ data: updated });
    }

    const parsed = stockAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const stockItem = await prisma.stockItem.findFirst({
      where: { id: input.stockItemId, orgId: session.orgId, deletedAt: null },
      select: {
        id: true,
        containerId: true,
        item: true,
        qtyReceived: true,
        qtyAvailable: true,
        qtyReserved: true,
        qtySold: true,
        qtyWastage: true,
        qtyDump: true,
        uom: true,
      },
    });

    if (!stockItem) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    const next = await prisma.$transaction(async (tx) => {
      const available = Number(stockItem.qtyAvailable);
      const reserved = Number(stockItem.qtyReserved);
      const received = Number(stockItem.qtyReceived);

      let update: {
        qtyReceived?: number;
        qtyAvailable: number;
        qtyReserved: number;
        qtyWastage: number;
        qtyDump: number;
      } = {
        qtyAvailable: available,
        qtyReserved: reserved,
        qtyWastage: Number(stockItem.qtyWastage),
        qtyDump: Number(stockItem.qtyDump),
      };

      let movementKind: "Reserve" | "Release" | "Wastage" | "Dump" | "Adjust" =
        "Adjust";
      let nextReceived = received;

      if (input.action === "reserve") {
        if (available < input.qty) {
          throw new Error("INSUFFICIENT_AVAILABLE");
        }
        update.qtyAvailable = available - input.qty;
        update.qtyReserved = reserved + input.qty;
        movementKind = "Reserve";
      } else if (input.action === "release") {
        if (reserved < input.qty) {
          throw new Error("INSUFFICIENT_RESERVED");
        }
        update.qtyAvailable = available + input.qty;
        update.qtyReserved = reserved - input.qty;
        movementKind = "Release";
      } else if (input.action === "wastage") {
        if (available < input.qty) {
          throw new Error("INSUFFICIENT_AVAILABLE");
        }
        update.qtyAvailable = available - input.qty;
        update.qtyWastage = Number(stockItem.qtyWastage) + input.qty;
        movementKind = "Wastage";
      } else if (input.action === "dump") {
        if (available < input.qty) {
          throw new Error("INSUFFICIENT_AVAILABLE");
        }
        update.qtyAvailable = available - input.qty;
        update.qtyDump = Number(stockItem.qtyDump) + input.qty;
        movementKind = "Dump";
      } else if (input.action === "adjust") {
        if (input.direction === "increase") {
          nextReceived += input.qty;
          update.qtyAvailable = available + input.qty;
          update.qtyReceived = nextReceived;
        } else {
          if (available < input.qty) {
            throw new Error("INSUFFICIENT_AVAILABLE");
          }
          nextReceived -= input.qty;
          update.qtyAvailable = available - input.qty;
          update.qtyReceived = nextReceived;
        }
        movementKind = "Adjust";
      }

      const updated = await tx.stockItem.update({
        where: { id: stockItem.id },
        data: update,
      });

      await tx.stockMovement.create({
        data: {
          orgId: session.orgId,
          stockItemId: stockItem.id,
          kind: movementKind,
          qty: input.qty,
          uom: stockItem.uom,
          reason:
            input.reason?.trim() ||
            `${input.action}${input.action === "adjust" ? ` (${input.direction})` : ""}`,
          refType: input.refType?.trim() || null,
          refId: input.refId?.trim() || null,
          createdById: session.userId,
        },
      });

      return updated;
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: `stock_${input.action}`,
      entityType: "stock",
      entityId: stockItem.id,
      summary: `${input.action} ${input.qty} ${stockItem.uom} on ${stockItem.item}`,
      metadata: {
        stockItemId: stockItem.id,
        containerId: stockItem.containerId,
        action: input.action,
        qty: input.qty,
        direction: input.direction ?? null,
        reason: input.reason ?? null,
      },
    });

    return NextResponse.json({ data: next });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INSUFFICIENT_AVAILABLE") {
        return NextResponse.json(
          { error: "Not enough available stock for that action" },
          { status: 409 }
        );
      }
      if (err.message === "INSUFFICIENT_RESERVED") {
        return NextResponse.json(
          { error: "Not enough reserved stock to release" },
          { status: 409 }
        );
      }
    }
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/warehouse-stock]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
