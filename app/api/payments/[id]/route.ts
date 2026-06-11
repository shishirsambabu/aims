import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { updatePaymentSchema } from "@/lib/validations/payment";
import { deriveStatus } from "@/lib/data/payments";
import { paymentCanBePaid, paymentReviewBlocker } from "@/lib/payment-workflow";

interface Params {
  params: Promise<{ id: string }>;
}

function paymentSnapshot(payment: {
  amountRequested: unknown;
  amountPaid: unknown;
  status: string;
  approvalStatus: string;
  paidDate?: Date | null;
}) {
  return {
    amountRequested: Number(payment.amountRequested),
    amountPaid: Number(payment.amountPaid),
    status: payment.status,
    approvalStatus: payment.approvalStatus,
    paidDate: payment.paidDate?.toISOString() ?? null,
  };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "financials.view")) {
      return NextResponse.json(
        { error: "You do not have permission to view or edit payments" },
        { status: 403 }
      );
    }
    const body = (await request.json()) as Record<string, unknown> & {
      action?: "approve" | "reject";
      reason?: string;
    };
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;

    const existing = await prisma.payment.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.action === "approve" || body.action === "reject") {
      if (!can(session.role, "payment.approve")) {
        return NextResponse.json(
          { error: "You do not have permission to approve payments" },
          { status: 403 }
        );
      }
      const blocker = paymentReviewBlocker({
        action: body.action,
        requestedById: existing.requestedById,
        reviewerId: session.userId,
        approvalStatus: existing.approvalStatus,
        reason,
      });
      if (blocker) {
        return NextResponse.json(
          { error: blocker },
          { status: blocker.includes("reason") ? 422 : 409 }
        );
      }
      const payment = await prisma.payment.update({
        where: { id },
        data: {
          approvalStatus: body.action === "approve" ? "Approved" : "Rejected",
          approvedById: session.userId,
          approvedAt: new Date(),
          notes: reason
            ? `${existing.notes ? `${existing.notes}\n` : ""}Review note: ${reason}`
            : existing.notes,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: `payment_${body.action}d`,
        entityType: "container",
        entityId: existing.containerId,
        summary: `Payment ${body.action === "approve" ? "approved" : "rejected"} (${existing.currency} ${Number(existing.amountRequested).toLocaleString()})`,
        metadata: {
          reason,
          before: paymentSnapshot(existing),
          after: paymentSnapshot(payment),
        },
      });
      return NextResponse.json({ data: payment });
    }

    if (!can(session.role, "payment.pay")) {
      return NextResponse.json(
        { error: "You do not have permission to record payments" },
        { status: 403 }
      );
    }
    if (!paymentCanBePaid(existing.approvalStatus)) {
      return NextResponse.json(
        { error: "Payment must be approved before it can be paid" },
        { status: 409 }
      );
    }
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to record a payment update" },
        { status: 422 }
      );
    }

    const parsed = updatePaymentSchema.safeParse(body);
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
      where: { id },
      data: {
        amountPaid,
        status,
        paidDate:
          input.paidDate ??
          (status === "Paid" && !existing.paidDate ? new Date() : undefined),
        reference: input.reference,
        notes: input.notes ?? existing.notes,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_payment",
      entityType: "container",
      entityId: existing.containerId,
      summary: `Payment ${status} - paid ${existing.currency} ${amountPaid.toLocaleString()}`,
      metadata: {
        reason,
        before: paymentSnapshot(existing),
        after: paymentSnapshot(payment),
      },
    });

    return NextResponse.json({ data: payment });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "financials.view") || !can(session.role, "payment.write")) {
      return NextResponse.json(
        { error: "You do not have permission to delete payments" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to archive a payment request" },
        { status: 422 }
      );
    }

    const existing = await prisma.payment.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.payment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
        deleteReason: reason,
      },
    });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "archived_payment",
      entityType: "container",
      entityId: existing.containerId,
      summary: "Payment request archived",
      metadata: { reason, before: paymentSnapshot(existing) },
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
