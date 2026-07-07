import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { listStockItems } from "@/lib/data/stock";
import { stockGradeSchema } from "@/lib/validations/stock";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "warehouse.adjust") && !can(session.role, "warehouse.receive")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = stockGradeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const source = await prisma.stockItem.findFirst({
      where: { id: input.stockItemId, orgId: session.orgId, deletedAt: null },
      select: {
        id: true,
        orgId: true,
        containerId: true,
        warehouseId: true,
        item: true,
        variety: true,
        grade: true,
        uom: true,
        qtyAvailable: true,
        qtyReceived: true,
        qtyReserved: true,
        lotNo: true,
        palletNo: true,
        packDate: true,
        expiryDate: true,
        bestBeforeDate: true,
        storageCondition: true,
        ripeningState: true,
        locationId: true,
        qualityStatus: true,
        temperatureAtReceiptC: true,
        temperatureBreach: true,
        qualityHoldReason: true,
        container: { select: { containerNo: true, blNo: true } },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    const totalSplit = input.rows.reduce((sum, row) => sum + row.qtySplit, 0);
    const available = Number(source.qtyAvailable);
    if (totalSplit <= 0) {
      return NextResponse.json(
        { error: "Split quantities must total to a positive value" },
        { status: 422 }
      );
    }
    if (totalSplit > available) {
      return NextResponse.json(
        { error: "Split quantity exceeds available stock" },
        { status: 409 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const parent = await tx.stockItem.update({
        where: { id: source.id },
        data: { qtyAvailable: available - totalSplit },
      });

      await tx.stockMovement.create({
        data: {
          orgId: session.orgId,
          stockItemId: source.id,
          kind: "Grade",
          qty: totalSplit,
          uom: source.uom,
          reason: input.reason?.trim() || `Graded into ${input.rows.length} child lot(s)`,
          refType: "stock_item",
          refId: source.id,
          createdById: session.userId,
        },
      });

      const childLots = [];
      for (const row of input.rows) {
        const child = await tx.stockItem.create({
          data: {
            orgId: session.orgId,
            containerId: source.containerId,
            warehouseId: source.warehouseId,
            parentStockItemId: source.id,
            item: row.item?.trim() || source.item,
            variety: row.variety?.trim() || source.variety,
            grade: row.grade.trim(),
            uom: row.uom,
            qtyReceived: row.qtySplit,
            qtyAvailable: row.qtySplit,
            qtyReserved: 0,
            qtySold: 0,
            qtyWastage: 0,
            qtyDump: 0,
            perUnitWeightKg: row.perUnitWeightKg ?? null,
            lotNo: row.lotNo?.trim() || source.lotNo,
            palletNo: row.palletNo?.trim() || source.palletNo,
            packDate: row.packDate ?? source.packDate,
            expiryDate: row.expiryDate ?? source.expiryDate,
            bestBeforeDate: row.bestBeforeDate ?? source.bestBeforeDate,
            storageCondition: row.storageCondition?.trim() || source.storageCondition,
            ripeningState: row.ripeningState?.trim() || source.ripeningState,
            locationId: source.locationId,
            qualityStatus: source.qualityStatus,
            temperatureAtReceiptC: source.temperatureAtReceiptC,
            temperatureBreach: source.temperatureBreach,
            qualityHoldReason: source.qualityHoldReason,
          },
        });

        await tx.stockMovement.create({
          data: {
            orgId: session.orgId,
            stockItemId: child.id,
            kind: "Receive",
            qty: row.qtySplit,
            uom: row.uom,
            reason: `Created from grading source lot ${source.lotNo ?? source.id}`,
            refType: "stock_item",
            refId: source.id,
            createdById: session.userId,
          },
        });

        childLots.push(child);
      }

      return { parent, childLots };
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "stock_graded",
      entityType: "stock",
      entityId: source.id,
      summary: `Graded ${totalSplit} ${source.uom} from ${source.item}`,
      metadata: {
        stockItemId: source.id,
        containerId: source.containerId,
        totalSplit,
        lines: input.rows.length,
        childIds: created.childLots.map((lot) => lot.id),
      },
    });

    const payload = await listStockItems(session.orgId, {
      warehouseId: source.warehouseId,
    });
    return NextResponse.json(
      {
        data: {
          parent: created.parent,
          childLots: created.childLots,
          stock: payload,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/warehouse-stock/grade]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
