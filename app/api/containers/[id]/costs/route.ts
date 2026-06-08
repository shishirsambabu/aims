import { NextResponse, type NextRequest } from "next/server";

import { requireSession, canWrite } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { costSchema } from "@/lib/validations/finance";
import { computeCost, computeProfit } from "@/lib/finance";

interface Params {
  params: { id: string };
}

/** Upsert landing costs, recompute totals + rate/box, and re-derive profit. */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    if (!canWrite(session.role)) {
      return NextResponse.json(
        { error: "You do not have permission to edit costs" },
        { status: 403 }
      );
    }

    const container = await prisma.container.findFirst({
      where: { id: params.id, orgId: session.orgId },
      select: { id: true, noOfBoxes: true, containerNo: true },
    });
    if (!container) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = costSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const computed = computeCost(input, container.noOfBoxes);

    const data = {
      orgId: session.orgId,
      beInvoiceValueInr: input.beInvoiceValueInr,
      exchangeRate: input.exchangeRate,
      customsDuty: input.customsDuty,
      clearingCharges: input.clearingCharges,
      linerCharges: input.linerCharges,
      detention: input.detention,
      chaCharges: input.chaCharges,
      transport: input.transport,
      ohProportion: input.ohProportion,
      claimDeduction: input.claimDeduction,
      otherCharges: input.otherCharges,
      totalCost: computed.totalCost,
      ratePerBoxLanding: computed.ratePerBoxLanding,
      ratePerBox: computed.ratePerBox,
    };

    const cost = await prisma.containerCost.upsert({
      where: { containerId: container.id },
      create: { containerId: container.id, ...data },
      update: data,
    });

    // Keep cached profit in sync with the new total cost.
    await resyncProfit(session.orgId, container.id, computed.totalCost);

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_costs",
      entityType: "container",
      entityId: container.id,
      summary: `Updated costs for ${container.containerNo} — total ₹${computed.totalCost.toLocaleString(
        "en-IN"
      )}`,
    });

    return NextResponse.json({ data: cost });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/containers/:id/costs]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/** Recompute the sale's cached profit fields against a new total cost. */
async function resyncProfit(
  orgId: string,
  containerId: string,
  totalCost: number
) {
  const sale = await prisma.sale.findUnique({ where: { containerId } });
  if (!sale) return;
  const profit = computeProfit(
    {
      saleValue: sale.saleValue ? Number(sale.saleValue) : null,
      damageValue: sale.damageValue ? Number(sale.damageValue) : null,
      soldQty: sale.soldQty,
    },
    totalCost
  );
  await prisma.sale.update({
    where: { containerId },
    data: {
      profit: profit.profit,
      profitPerBox: profit.profitPerBox,
      marginPct: profit.marginPct,
    },
  });
}
