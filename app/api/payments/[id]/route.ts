import { NextResponse, type NextRequest } from "next/server";

import { requireSession, canWrite } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { updatePaymentSchema } from "@/lib/validations/payment";
import { deriveStatus } from "@/lib/data/payments";

interface Params {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    if (!canWrite(session.role)) {
      return NextResponse.json(
        { error: "You do not have permission to update payments" },
        { status: 403 }
      );
    }

    const existing = await prisma.payment.findFirst({
      where: { id: params.id, orgId: session.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = updatePaymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const input = parsed.data;

    const amountPaid = input.amountPaid ?? Number(existing.amountPaid);
    const requested = Number(existing.amountRequested);
    const status = input.status ?? deriveStatus(requested, amountPaid);

    const payment = await prisma.payment.update({
      where: { id: params.id },
      data: {
        amountPaid,
        status,
        paidDate:
          input.paidDate ??
          (status === "Paid" && !existing.paidDate ? new Date() : undefined),
        reference: input.reference,
        notes: input.notes,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_payment",
      entityType: "container",
      entityId: existing.containerId,
      summary: `Payment ${status} — paid ${existing.currency} ${amountPaid.toLocaleString()}`,
    });

    return NextResponse.json({ data: payment });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    if (!canWrite(session.role)) {
      return NextResponse.json(
        { error: "You do not have permission to delete payments" },
        { status: 403 }
      );
    }
    const existing = await prisma.payment.findFirst({
      where: { id: params.id, orgId: session.orgId },
      select: { id: true, containerId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.payment.delete({ where: { id: params.id } });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "deleted_payment",
      entityType: "container",
      entityId: existing.containerId,
      summary: "Payment request deleted",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/payments/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
