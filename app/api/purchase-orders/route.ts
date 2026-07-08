import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { nextDocumentNumber } from "@/lib/document-sequence";
import { reportError } from "@/lib/observability";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const currencySchema = z.enum(["USD", "AED", "INR"]);

const purchaseOrderLineSchema = z.object({
  item: z.string().min(2).max(120),
  variety: z.string().max(120).optional(),
  packSpec: z.string().max(120).optional(),
  qty: z.coerce.number().positive(),
  uom: z.string().min(1).max(20).default("Box"),
  unitCost: z.coerce.number().nonnegative(),
  hsnCode: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  containerId: z.string().uuid().optional(),
  poDate: z.coerce.date().optional(),
  currency: currencySchema.default("USD"),
  estimatedFreight: z.coerce.number().nonnegative().optional(),
  estimatedDuties: z.coerce.number().nonnegative().optional(),
  estimatedLocalCosts: z.coerce.number().nonnegative().optional(),
  actualLandedCost: z.coerce.number().nonnegative().optional(),
  advancePaidAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(purchaseOrderLineSchema).min(1),
});

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "payment.view") && !can(session.role, "financials.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const url = new URL(request.url);
    const supplierId = url.searchParams.get("supplierId") ?? undefined;
    const containerId = url.searchParams.get("containerId") ?? undefined;

    const rows = await prisma.purchaseOrder.findMany({
      where: {
        orgId: session.orgId,
        ...(supplierId ? { supplierId } : {}),
        ...(containerId ? { containerId } : {}),
      },
      orderBy: [{ poDate: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        supplier: { select: { id: true, name: true, country: true } },
        container: { select: { id: true, containerNo: true, blNo: true, status: true } },
        lines: { orderBy: { lineNo: "asc" } },
      },
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "purchase-orders", method: "GET" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "payment.write") && !can(session.role, "masterdata.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = purchaseOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const [supplier, container] = await Promise.all([
      prisma.supplier.findFirst({
        where: { id: input.supplierId, orgId: session.orgId, deletedAt: null },
        select: { id: true },
      }),
      input.containerId
        ? prisma.container.findFirst({
            where: { id: input.containerId, orgId: session.orgId, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    if (input.containerId && !container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    const goodsValue = money(
      input.lines.reduce((sum, line) => sum + Number(line.qty) * Number(line.unitCost), 0)
    );
    const estimatedTotal = money(
      goodsValue +
        Number(input.estimatedFreight ?? 0) +
        Number(input.estimatedDuties ?? 0) +
        Number(input.estimatedLocalCosts ?? 0)
    );
    const varianceAmount =
      input.actualLandedCost == null ? null : money(Number(input.actualLandedCost) - estimatedTotal);

    const created = await prisma.$transaction(async (tx) => {
      const poNo = await nextDocumentNumber(tx, session.orgId, "purchase-order", "PO", 5);
      return tx.purchaseOrder.create({
        data: {
          orgId: session.orgId,
          poNo,
          supplierId: input.supplierId,
          containerId: input.containerId ?? null,
          poDate: input.poDate ?? new Date(),
          status: "Draft",
          currency: input.currency,
          estimatedGoodsValue: goodsValue,
          estimatedFreight: input.estimatedFreight ?? 0,
          estimatedDuties: input.estimatedDuties ?? 0,
          estimatedLocalCosts: input.estimatedLocalCosts ?? 0,
          actualLandedCost: input.actualLandedCost ?? null,
          varianceAmount,
          advancePaidAmount: input.advancePaidAmount ?? null,
          notes: input.notes ?? null,
          createdById: session.userId,
          lines: {
            create: input.lines.map((line, index) => ({
              orgId: session.orgId,
              lineNo: index + 1,
              item: line.item,
              variety: line.variety ?? null,
              packSpec: line.packSpec ?? null,
              qty: line.qty,
              uom: line.uom,
              unitCost: line.unitCost,
              lineTotal: money(Number(line.qty) * Number(line.unitCost)),
              hsnCode: line.hsnCode ?? process.env.DEFAULT_FRUIT_HSN_CODE ?? "0810",
              notes: line.notes ?? null,
            })),
          },
        },
        include: { lines: true },
      });
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "purchase-orders", method: "POST" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
