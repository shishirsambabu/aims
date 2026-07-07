import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { listGatePasses } from "@/lib/data/dispatch";
import { nextDocumentNumber } from "@/lib/document-sequence";
import { gatePassActionSchema, gatePassSchema } from "@/lib/validations/stock";
import { recomputeContainerSalesFromDispatch } from "@/lib/container-sales";

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "inventory.view") && !can(session.role, "sales.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    return NextResponse.json({ data: await listGatePasses(session.orgId) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "warehouse.fulfil")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = gatePassSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const lines = input.lines;
    const stockItems = await prisma.stockItem.findMany({
      where: {
        orgId: session.orgId,
        deletedAt: null,
        qualityStatus: "Released",
        id: { in: lines.map((line) => line.stockItemId) },
      },
      select: {
        id: true,
        containerId: true,
        warehouseId: true,
        item: true,
        grade: true,
        uom: true,
        qtyAvailable: true,
        qtyReserved: true,
        container: { select: { containerNo: true, blNo: true } },
      },
    });

    if (stockItems.length !== lines.length) {
      return NextResponse.json(
        { error: "One or more stock items were not found or are on quality hold" },
        { status: 404 }
      );
    }

    const firstWarehouseId = stockItems[0].warehouseId;
    if (stockItems.some((item) => item.warehouseId !== firstWarehouseId)) {
      return NextResponse.json(
        { error: "All dispatch lines must belong to the same warehouse" },
        { status: 409 }
      );
    }
    if (input.warehouseId !== firstWarehouseId) {
      return NextResponse.json(
        { error: "The warehouse does not match the selected stock" },
        { status: 409 }
      );
    }
    if (input.containerId) {
      const containerIds = new Set(stockItems.map((item) => item.containerId));
      if (containerIds.size !== 1 || !containerIds.has(input.containerId)) {
        return NextResponse.json(
          { error: "The selected container does not match the dispatch lines" },
          { status: 409 }
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const gatePassNo = await nextDocumentNumber(tx, session.orgId, "gate-pass", "GP", 5);
      const gatePass = await tx.gatePass.create({
        data: {
          orgId: session.orgId,
          warehouseId: firstWarehouseId,
          containerId: input.containerId ?? stockItems[0].containerId ?? null,
          stockItemId: lines.length === 1 ? lines[0].stockItemId : null,
          gatePassNo,
          vehicleNo: input.vehicleNo?.trim() || null,
          driverName: input.driverName?.trim() || null,
          driverContact: input.driverContact?.trim() || null,
          vehicleSealNo: input.vehicleSealNo?.trim() || null,
          loadingPhotoRef: input.loadingPhotoRef?.trim() || null,
          routeName: input.routeName?.trim() || null,
          beatName: input.beatName?.trim() || null,
          deliveryInstructions: input.deliveryInstructions?.trim() || null,
          returnCratesPlanned: input.returnCratesPlanned ?? 0,
          returnPalletsPlanned: input.returnPalletsPlanned ?? 0,
          securityOtp: generateSecurityOtp(),
          notes: input.notes?.trim() || null,
          exceptionReason: input.exceptionReason,
          status: "Picked",
          pickedAt: new Date(),
          createdById: session.userId,
        },
      });

      const createdLines = [];
      for (const line of lines) {
        const stock = stockItems.find((item) => item.id === line.stockItemId);
        if (!stock) continue;
        const qty = line.qty;
        const available = Number(stock.qtyAvailable);
        if (qty > available) {
          throw new Error("INSUFFICIENT_AVAILABLE");
        }

        const reserved = await tx.stockItem.updateMany({
          where: {
            id: stock.id,
            orgId: session.orgId,
            qualityStatus: "Released",
            deletedAt: null,
            qtyAvailable: { gte: qty },
          },
          data: {
            qtyAvailable: { decrement: qty },
            qtyReserved: { increment: qty },
          },
        });
        if (reserved.count !== 1) throw new Error("INSUFFICIENT_AVAILABLE");

        const createdLine = await tx.gatePassLine.create({
          data: {
            orgId: session.orgId,
            gatePassId: gatePass.id,
            stockItemId: stock.id,
            qtyPlanned: qty,
            qtyDispatched: 0,
            uom: stock.uom,
          },
        });
        createdLines.push(createdLine);
      }

      return { gatePass, createdLines };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "gate_pass_created",
      entityType: "gate_pass",
      entityId: created.gatePass.id,
      summary: `Created gate pass ${created.gatePass.gatePassNo}`,
      metadata: {
        gatePassId: created.gatePass.id,
        gatePassNo: created.gatePass.gatePassNo,
        lines: created.createdLines.length,
      },
    });

    return NextResponse.json(
      {
        data: await listGatePasses(session.orgId),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_AVAILABLE") {
      return NextResponse.json(
        { error: "Not enough available stock for dispatch" },
        { status: 409 }
      );
    }
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "warehouse.fulfil")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = gatePassActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const gatePass = await prisma.gatePass.findFirst({
      where: { id: input.gatePassId, orgId: session.orgId },
      include: {
        lines: {
          include: {
            stockItem: { select: { containerId: true } },
          },
        },
      },
    });
    if (!gatePass) {
      return NextResponse.json({ error: "Gate pass not found" }, { status: 404 });
    }

    if (input.action === "fleet") {
      if (gatePass.status === "Cancelled") {
        return NextResponse.json(
          { error: "Cannot add fleet details to a cancelled gate pass" },
          { status: 409 }
        );
      }
      await prisma.gatePass.update({
        where: { id: gatePass.id },
        data: {
          vehicleNo: input.vehicleNo?.trim() || null,
          driverName: input.driverName?.trim() || null,
          driverContact: input.driverContact?.trim() || null,
          vehicleSealNo: input.vehicleSealNo?.trim() || null,
          loadingPhotoRef: input.loadingPhotoRef?.trim() || null,
          routeName: input.routeName?.trim() || null,
          beatName: input.beatName?.trim() || null,
          deliveryInstructions: input.deliveryInstructions?.trim() || null,
          returnCratesPlanned: input.returnCratesPlanned ?? gatePass.returnCratesPlanned,
          returnPalletsPlanned: input.returnPalletsPlanned ?? gatePass.returnPalletsPlanned,
          securityOtp: gatePass.securityOtp || generateSecurityOtp(),
          notes: input.notes?.trim() || gatePass.notes,
        },
      });
    } else if (input.action === "gate") {
      if (gatePass.status === "Cancelled") {
        return NextResponse.json(
          { error: "Cannot confirm security gate exit for a cancelled gate pass" },
          { status: 409 }
        );
      }
      if (!gatePass.securityOtp || input.securityOtp !== gatePass.securityOtp) {
        return NextResponse.json(
          { error: "Security OTP does not match this gate pass" },
          { status: 409 }
        );
      }
      if (!gatePass.vehicleSealNo || !gatePass.loadingPhotoRef) {
        return NextResponse.json(
          { error: "Seal number and loading photo/proof are required before security gate exit" },
          { status: 409 }
        );
      }
      await prisma.gatePass.update({
        where: { id: gatePass.id },
        data: { securityGateOutAt: new Date() },
      });
    } else if (input.action === "pod") {
      if (!input.podRef || !input.podAcknowledgedBy) {
        return NextResponse.json(
          { error: "POD reference and customer acknowledgement are required" },
          { status: 422 }
        );
      }
      await prisma.gatePass.update({
        where: { id: gatePass.id },
        data: {
          podRef: input.podRef.trim(),
          podAcknowledgedBy: input.podAcknowledgedBy.trim(),
          podAcknowledgedAt: new Date(),
        },
      });
    } else if (input.action === "returns") {
      await prisma.gatePass.update({
        where: { id: gatePass.id },
        data: {
          returnCratesReceived: input.returnCratesReceived ?? gatePass.returnCratesReceived,
          returnPalletsReceived: input.returnPalletsReceived ?? gatePass.returnPalletsReceived,
        },
      });
    } else if (input.action === "cancel") {
      if (gatePass.status === "Dispatched") {
        return NextResponse.json(
          { error: "Cannot cancel a dispatched gate pass" },
          { status: 409 }
        );
      }

      const affectedContainers = new Set<string>();
      await prisma.$transaction(async (tx) => {
        for (const line of gatePass.lines) {
          const remaining = Number(line.qtyPlanned) - Number(line.qtyDispatched);
          if (remaining <= 0) continue;
          if (line.stockItem?.containerId) {
            affectedContainers.add(line.stockItem.containerId);
          }
          await tx.stockItem.update({
            where: { id: line.stockItemId },
            data: {
              qtyAvailable: { increment: remaining },
              qtyReserved: { decrement: remaining },
            },
          });
        }
        await tx.gatePass.update({
          where: { id: gatePass.id },
          data: { status: "Cancelled" },
        });
        if (gatePass.salesOrderId) {
          await updateSalesOrderFulfillmentState(tx, gatePass.salesOrderId);
        }
        await recomputeContainerSalesFromDispatch(
          tx,
          session.orgId,
          session.userId,
          [gatePass.containerId, ...affectedContainers].filter((value): value is string => !!value)
        );
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } else if (input.action === "pack" || input.action === "ready") {
      const update: Record<string, unknown> = {
        status: input.action === "pack" ? "Packed" : "Ready",
      };
      if (input.action === "pack") update.packedAt = new Date();
      if (input.action === "ready") update.readyAt = new Date();
      await prisma.gatePass.update({ where: { id: gatePass.id }, data: update });
    } else if (input.action === "dispatch") {
      if (!gatePass.vehicleNo || !gatePass.driverName) {
        return NextResponse.json(
          { error: "Log vehicle number and driver name before final dispatch" },
          { status: 409 }
        );
      }
      if (!gatePass.securityGateOutAt) {
        return NextResponse.json(
          { error: "Security gate exit must be confirmed before final dispatch" },
          { status: 409 }
        );
      }
      const dispatchedMap = new Map(
        (input.lineDispatchedQtys ?? []).map((line) => [line.lineId, line.qty])
      );

      const affectedContainers = new Set<string>();
      await prisma.$transaction(async (tx) => {
        let anyRemaining = false;
        for (const line of gatePass.lines) {
          const planned = Number(line.qtyPlanned);
          const already = Number(line.qtyDispatched);
          const remaining = planned - already;
          const dispatchQty =
            dispatchedMap.get(line.id) ?? remaining;

          if (dispatchQty > remaining) {
            throw new Error("DISPATCH_EXCEEDS_REMAINING");
          }
          if (dispatchQty <= 0) {
            if (remaining > 0) anyRemaining = true;
            continue;
          }
          if (line.stockItem?.containerId) {
            affectedContainers.add(line.stockItem.containerId);
          }

          const lineUpdated = await tx.gatePassLine.updateMany({
            where: { id: line.id, qtyDispatched: already },
            data: { qtyDispatched: already + dispatchQty },
          });
          if (lineUpdated.count !== 1) throw new Error("DISPATCH_STATE_CONFLICT");

          const stockUpdated = await tx.stockItem.updateMany({
            where: {
              id: line.stockItemId,
              orgId: session.orgId,
              qtyReserved: { gte: dispatchQty },
            },
            data: {
              qtyReserved: { decrement: dispatchQty },
              qtySold: { increment: dispatchQty },
            },
          });
          if (stockUpdated.count !== 1) throw new Error("DISPATCH_STATE_CONFLICT");

          if (remaining - dispatchQty > 0) {
            anyRemaining = true;
          }
        }

        await tx.gatePass.update({
          where: { id: gatePass.id },
          data: {
            status: anyRemaining ? "PartiallyDispatched" : "Dispatched",
            dispatchedAt: anyRemaining ? undefined : new Date(),
          },
        });
        if (gatePass.salesOrderId) {
          await updateSalesOrderFulfillmentState(tx, gatePass.salesOrderId);
        }
        await recomputeContainerSalesFromDispatch(
          tx,
          session.orgId,
          session.userId,
          [gatePass.containerId, ...affectedContainers].filter((value): value is string => !!value)
        );
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: `gate_pass_${input.action}`,
      entityType: "gate_pass",
      entityId: gatePass.id,
      summary: `Gate pass ${gatePass.gatePassNo} -> ${input.action}`,
      metadata: {
        gatePassId: gatePass.id,
        action: input.action,
      },
    });

    return NextResponse.json({ data: await listGatePasses(session.orgId) });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "DISPATCH_EXCEEDS_REMAINING") {
        return NextResponse.json(
          { error: "Dispatch quantity exceeds the remaining reserved amount" },
          { status: 409 }
        );
      }
      if (err.message === "DISPATCH_STATE_CONFLICT") {
        return NextResponse.json(
          { error: "Dispatch state changed. Refresh the board before trying again." },
          { status: 409 }
        );
      }
    }
    return handleError(err);
  }
}

function generateSecurityOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function updateSalesOrderFulfillmentState(
  tx: Prisma.TransactionClient,
  salesOrderId: string
) {
  const order = await tx.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: {
      gatePasses: {
        where: { status: { not: "Cancelled" } },
        include: {
          lines: true,
        },
      },
    },
  });
  if (!order) return;

  let totalDispatched = 0;
  for (const gatePass of order.gatePasses) {
    for (const line of gatePass.lines) {
      totalDispatched += Number(line.qtyDispatched);
    }
  }

  const nextStatus =
    totalDispatched === 0
      ? "Approved"
      : totalDispatched >= Number(order.totalQty ?? 0)
        ? "Fulfilled"
        : "PartiallyFulfilled";

  await tx.salesOrder.update({
    where: { id: salesOrderId },
    data: {
      status: nextStatus,
    },
  });
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/warehouse-dispatch]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
