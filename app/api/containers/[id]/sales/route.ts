import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { saleSchema } from "@/lib/validations/finance";
import { computeProfit } from "@/lib/finance";

interface Params {
  params: { id: string };
}

/** Upsert sales figures and recompute profit / profit-per-box / margin. */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    if (!can(session.role, "sale.write")) {
      return NextResponse.json(
        { error: "You do not have permission to edit sales" },
        { status: 403 }
      );
    }

    const container = await prisma.container.findFirst({
      where: { id: params.id, orgId: session.orgId, deletedAt: null },
      select: { id: true, containerNo: true, cost: { select: { totalCost: true } } },
    });
    if (!container) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = saleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const totalCost = container.cost?.totalCost
      ? Number(container.cost.totalCost)
      : 0;
    const profit = computeProfit(input, totalCost);

    const data = {
      orgId: session.orgId,
      soldQty: input.soldQty,
      avgPrice: input.avgPrice,
      saleValue: input.saleValue,
      damageQty: input.damageQty,
      damageValue: input.damageValue,
      profit: profit.profit,
      profitPerBox: profit.profitPerBox,
      marginPct: profit.marginPct,
    };

    const sale = await prisma.sale.upsert({
      where: { containerId: container.id },
      create: { containerId: container.id, ...data },
      update: data,
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_sales",
      entityType: "container",
      entityId: container.id,
      summary: `Updated sales for ${container.containerNo} — profit ₹${profit.profit.toLocaleString(
        "en-IN"
      )} (${profit.marginPct ?? 0}%)`,
    });

    return NextResponse.json({ data: sale });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/containers/:id/sales]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
