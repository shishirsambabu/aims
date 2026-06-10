import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { saleSchema } from "@/lib/validations/finance";
import { computeProfit } from "@/lib/finance";

interface Params {
  params: Promise<{ id: string }>;
}

function num(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function saleSnapshot(sale: Record<string, unknown> | null | undefined) {
  if (!sale) return null;
  return {
    soldQty: sale.soldQty ?? null,
    avgPrice: num(sale.avgPrice),
    saleValue: num(sale.saleValue),
    damageQty: sale.damageQty ?? null,
    damageValue: num(sale.damageValue),
    profit: num(sale.profit),
    profitPerBox: num(sale.profitPerBox),
    marginPct: num(sale.marginPct),
    approvalStatus: sale.approvalStatus ?? null,
  };
}

/** Upsert sales figures and submit them for review. */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "sale.write")) {
      return NextResponse.json(
        { error: "You do not have permission to edit sales" },
        { status: 403 }
      );
    }

    const container = await prisma.container.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: {
        id: true,
        containerNo: true,
        cost: { select: { totalCost: true } },
        sale: true,
      },
    });
    if (!container) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = saleSchema.safeParse(body);
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
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;

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
      approvalStatus: "PendingApproval" as const,
      reviewedById: null,
      reviewedAt: null,
      reviewNotes:
        reason ?? "Sales edited; review required before operational use.",
    };

    const before = saleSnapshot(container.sale);
    const sale = await prisma.sale.upsert({
      where: { containerId: container.id },
      create: { containerId: container.id, ...data },
      update: data,
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "submitted_sales_review",
      entityType: "container",
      entityId: container.id,
      summary: `Sales submitted for review for ${container.containerNo} - profit INR ${profit.profit.toLocaleString(
        "en-IN"
      )}`,
      metadata: {
        reason,
        before,
        after: saleSnapshot(sale),
      },
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

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "sale.approve")) {
      return NextResponse.json(
        { error: "You do not have permission to review sales" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      action?: "approve" | "reject";
      reason?: string;
    };
    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json({ error: "Invalid sales action" }, { status: 422 });
    }
    const reason = body.reason?.trim() || null;
    if (body.action === "reject" && !reason) {
      return NextResponse.json(
        { error: "A rejection reason is required" },
        { status: 422 }
      );
    }

    const container = await prisma.container.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true, containerNo: true, sale: true },
    });
    if (!container || !container.sale) {
      return NextResponse.json({ error: "Sales record not found" }, { status: 404 });
    }

    const before = saleSnapshot(container.sale);
    const sale = await prisma.sale.update({
      where: { containerId: container.id },
      data: {
        approvalStatus: body.action === "approve" ? "Approved" : "Rejected",
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes: reason,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: body.action === "approve" ? "approved_sales" : "rejected_sales",
      entityType: "container",
      entityId: container.id,
      summary: `Sales ${body.action === "approve" ? "approved" : "rejected"} for ${container.containerNo}`,
      metadata: {
        reason,
        before,
        after: saleSnapshot(sale),
      },
    });

    return NextResponse.json({ data: sale });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/containers/:id/sales PATCH]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
