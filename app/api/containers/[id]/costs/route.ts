import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { costSchema } from "@/lib/validations/finance";
import { computeCost, computeProfit } from "@/lib/finance";

interface Params {
  params: Promise<{ id: string }>;
}

function costSnapshot(cost: Record<string, unknown> | null | undefined) {
  if (!cost) return null;
  const keys = [
    "beInvoiceValueInr",
    "exchangeRate",
    "customsDuty",
    "clearingCharges",
    "linerCharges",
    "detention",
    "chaCharges",
    "igst",
    "cess",
    "transport",
    "ohProportion",
    "claimDeduction",
    "otherCharges",
    "totalCost",
    "ratePerBoxLanding",
    "ratePerBox",
    "finalized",
  ];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      typeof cost[key] === "object" && cost[key] !== null
        ? Number(cost[key])
        : (cost[key] ?? null),
    ])
  );
}

/** Upsert landing costs, recompute totals + rate/box, and re-derive profit. */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "cost.write")) {
      return NextResponse.json(
        { error: "You do not have permission to edit costs" },
        { status: 403 }
      );
    }

    const container = await prisma.container.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: {
        id: true,
        noOfBoxes: true,
        containerNo: true,
        cost: true,
      },
    });
    if (!container) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (container.cost?.finalized) {
      return NextResponse.json(
        { error: "Cost sheet is finalized - unlock it before editing" },
        { status: 409 }
      );
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
      igst: input.igst,
      cess: input.cess,
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

    await resyncProfit(session.orgId, container.id, computed.totalCost);

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_costs",
      entityType: "container",
      entityId: container.id,
      summary: `Updated costs for ${container.containerNo} - total INR ${computed.totalCost.toLocaleString(
        "en-IN"
      )}`,
      metadata: {
        before: costSnapshot(container.cost),
        after: costSnapshot(cost),
      },
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

/** Finalize (lock) or unlock a cost sheet - the maker-checker control. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const body = (await request.json()) as {
      finalized?: boolean;
      reason?: string;
    };
    const finalize = body.finalized !== false;
    const reason = body.reason?.trim() || null;

    const cap = finalize ? "cost.finalize" : "cost.unlock";
    if (!can(session.role, cap)) {
      return NextResponse.json(
        {
          error: finalize
            ? "You do not have permission to finalize cost sheets"
            : "Only a manager or admin can unlock a finalized cost sheet",
        },
        { status: 403 }
      );
    }
    if (!finalize && !reason) {
      return NextResponse.json(
        { error: "A reason is required to unlock a finalized cost sheet" },
        { status: 422 }
      );
    }

    const container = await prisma.container.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true, containerNo: true, cost: true },
    });
    if (!container) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!container.cost) {
      return NextResponse.json(
        { error: "Enter and save costs before finalizing" },
        { status: 409 }
      );
    }

    const cost = await prisma.containerCost.update({
      where: { containerId: container.id },
      data: {
        finalized: finalize,
        finalizedAt: finalize ? new Date() : null,
        finalizedById: finalize ? session.userId : null,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: finalize ? "finalized_costs" : "unlocked_costs",
      entityType: "container",
      entityId: container.id,
      summary: `${finalize ? "Finalized" : "Unlocked"} cost sheet for ${container.containerNo}`,
      metadata: {
        reason,
        before: costSnapshot(container.cost),
        after: costSnapshot(cost),
      },
    });

    return NextResponse.json({ data: cost });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/containers/:id/costs PATCH]", err);
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
      approvalStatus:
        sale.approvalStatus === "Approved" ? "PendingApproval" : sale.approvalStatus,
      reviewNotes:
        sale.approvalStatus === "Approved"
          ? "Cost changed; sales require re-review before operational use."
          : sale.reviewNotes,
    },
  });
}
