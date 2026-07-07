import { NextResponse, type NextRequest } from "next/server";

import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { customerReceiptCancelSchema } from "@/lib/validations/receipts";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "receipt.record")) {
      return NextResponse.json(
        { error: "You do not have permission to manage receipts" },
        { status: 403 }
      );
    }

    const parsed = customerReceiptCancelSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const receipt = await prisma.customerReceipt.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: {
        id: true,
        receiptNo: true,
        customerId: true,
        customer: { select: { name: true } },
      },
    });
    if (!receipt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.customerReceipt.update({
      where: { id: receipt.id },
      data: {
        status: "Cancelled",
        cancelledAt: new Date(),
        cancelledById: session.userId,
        cancelReason: parsed.data.reason ?? null,
        deletedAt: new Date(),
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "cancelled_customer_receipt",
      entityType: "customer_receipt",
      entityId: receipt.id,
      summary: `Cancelled receipt ${receipt.receiptNo} for ${receipt.customer.name}`,
      metadata: { reason: parsed.data.reason ?? null },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/customer-receipts/:id]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
