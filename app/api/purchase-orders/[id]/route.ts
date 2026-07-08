import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { reportError } from "@/lib/observability";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const PO_STATUSES = ["Draft", "Approved", "Shipped", "Linked", "Closed", "Cancelled"] as const;

const patchSchema = z.object({
  status: z.enum(PO_STATUSES).optional(),
  containerId: z.string().uuid().nullable().optional(),
  actualLandedCost: z.coerce.number().nonnegative().nullable().optional(),
  advancePaidAmount: z.coerce.number().nonnegative().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    if (!can(session.role, "payment.write") && !can(session.role, "masterdata.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const { id } = await context.params;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, orgId: session.orgId },
      select: {
        id: true,
        poNo: true,
        status: true,
        estimatedGoodsValue: true,
        estimatedFreight: true,
        estimatedDuties: true,
        estimatedLocalCosts: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }
    if (["Closed", "Cancelled"].includes(existing.status)) {
      return NextResponse.json(
        { error: `A ${existing.status.toLowerCase()} purchase order can no longer be edited` },
        { status: 409 }
      );
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const input = parsed.data;

    if (input.containerId) {
      const container = await prisma.container.findFirst({
        where: { id: input.containerId, orgId: session.orgId, deletedAt: null },
        select: { id: true },
      });
      if (!container) {
        return NextResponse.json({ error: "Container not found" }, { status: 404 });
      }
    }

    // Recompute estimate-vs-actual variance whenever actuals change.
    const estimatedTotal = money(
      Number(existing.estimatedGoodsValue) +
        Number(existing.estimatedFreight) +
        Number(existing.estimatedDuties) +
        Number(existing.estimatedLocalCosts)
    );
    const varianceAmount =
      input.actualLandedCost === undefined
        ? undefined
        : input.actualLandedCost === null
          ? null
          : money(Number(input.actualLandedCost) - estimatedTotal);

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.status === "Approved" ? { approvedAt: new Date() } : {}),
        ...(input.containerId !== undefined ? { containerId: input.containerId } : {}),
        ...(input.actualLandedCost !== undefined
          ? { actualLandedCost: input.actualLandedCost, varianceAmount }
          : {}),
        ...(input.advancePaidAmount !== undefined
          ? { advancePaidAmount: input.advancePaidAmount }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        container: { select: { id: true, containerNo: true } },
        lines: { orderBy: { lineNo: "asc" } },
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: input.status ? `po_${input.status.toLowerCase()}` : "updated_po",
      entityType: "purchase_order",
      entityId: updated.id,
      summary: `PO ${existing.poNo}${input.status ? ` → ${input.status}` : " updated"}`,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "purchase-orders/[id]", method: "PATCH" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
