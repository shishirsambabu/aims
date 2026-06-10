import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { listPayments } from "@/lib/data/payments";
import { createPaymentSchema } from "@/lib/validations/payment";
import type { PaymentStatus } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "financials.view")) {
      return NextResponse.json({ error: "You do not have permission to view payments" }, { status: 403 });
    }
    const sp = request.nextUrl.searchParams;
    const rows = await listPayments(session.orgId, {
      q: sp.get("q") ?? undefined,
      status: (sp.get("status") as PaymentStatus) ?? undefined,
      containerId: sp.get("containerId") ?? undefined,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "financials.view")) {
      return NextResponse.json(
        { error: "You do not have permission to add payments" },
        { status: 403 }
      );
    }
    if (!can(session.role, "payment.write")) {
      return NextResponse.json(
        { error: "You do not have permission to add payments" },
        { status: 403 }
      );
    }

    const parsed = createPaymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const input = parsed.data;

    const container = await prisma.container.findFirst({
      where: { id: input.containerId, orgId: session.orgId },
      select: {
        id: true,
        containerNo: true,
        supplier: { select: { name: true } },
      },
    });
    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        orgId: session.orgId,
        containerId: container.id,
        supplierName: container.supplier?.name ?? null,
        amountRequested: input.amountRequested,
        currency: input.currency,
        requestDate: input.requestDate ?? new Date(),
        dueDate: input.dueDate,
        reference: input.reference,
        notes: input.notes,
        status: "Pending",
        // Maker-checker: the raiser is the maker; a different checker approves.
        approvalStatus: "PendingApproval",
        requestedById: session.userId,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "created_payment",
      entityType: "container",
      entityId: container.id,
      summary: `Payment request ${input.currency} ${input.amountRequested.toLocaleString()} for ${container.containerNo}`,
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/payments]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
