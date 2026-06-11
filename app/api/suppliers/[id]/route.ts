import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { updateSupplierSchema } from "@/lib/validations/supplier";

interface Params {
  params: Promise<{ id: string }>;
}

function supplierSnapshot(supplier: {
  id: string;
  name: string;
  country: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  approvalStatus: string;
  pendingChanges: unknown;
}) {
  return {
    id: supplier.id,
    name: supplier.name,
    country: supplier.country,
    contactName: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    approvalStatus: supplier.approvalStatus,
    pendingChanges: supplier.pendingChanges,
  };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const body = await request.json();

    if (body.action === "approve" || body.action === "reject") {
      return reviewSupplier(id, session, body);
    }

    if (!can(session.role, "masterdata.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const existing = await prisma.supplier.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = updateSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        approvalStatus: "PendingApproval",
        pendingChanges: { action: "Update", data: parsed.data },
        requestedById: session.userId,
        reviewedById: null,
        reviewedAt: null,
        reviewNotes: "Supplier update pending approval.",
      },
    });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "requested_supplier_update",
      entityType: "supplier",
      entityId: supplier.id,
      summary: `Requested update for supplier ${supplier.name}`,
      metadata: {
        before: supplierSnapshot(existing),
        pending: parsed.data,
      },
    });
    return NextResponse.json({ data: supplier });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "masterdata.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to archive a supplier" },
        { status: 422 }
      );
    }
    const supplier = await prisma.supplier.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      include: { _count: { select: { containers: true } } },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (supplier._count.containers > 0) {
      return NextResponse.json(
        {
          error: `Can't archive - ${supplier._count.containers} container(s) use this supplier`,
        },
        { status: 409 }
      );
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        approvalStatus: "PendingApproval",
        pendingChanges: { action: "Archive", reason },
        requestedById: session.userId,
        reviewedById: null,
        reviewedAt: null,
        reviewNotes: reason,
      },
    });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "requested_supplier_archive",
      entityType: "supplier",
      entityId: supplier.id,
      summary: `Requested archive for supplier ${supplier.name}`,
      metadata: { reason, before: supplierSnapshot(supplier) },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleError(err);
  }
}

async function reviewSupplier(
  id: string,
  session: Awaited<ReturnType<typeof requireSession>>,
  body: { action?: "approve" | "reject"; reason?: string }
) {
  if (!can(session.role, "masterdata.approve")) {
    return NextResponse.json(
      { error: "You do not have permission to approve supplier changes" },
      { status: 403 }
    );
  }
  const reason = body.reason?.trim() || null;
  if (body.action === "reject" && !reason) {
    return NextResponse.json(
      { error: "A rejection reason is required" },
      { status: 422 }
    );
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id, orgId: session.orgId, deletedAt: null },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (supplier.approvalStatus !== "PendingApproval") {
    return NextResponse.json(
      { error: "Supplier has no pending approval item" },
      { status: 409 }
    );
  }

  if (body.action === "reject") {
    const rejected = await prisma.supplier.update({
      where: { id },
      data: {
        approvalStatus: "Rejected",
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes: reason,
      },
    });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "rejected_supplier_change",
      entityType: "supplier",
      entityId: supplier.id,
      summary: `Rejected supplier change for ${supplier.name}`,
      metadata: { reason, before: supplierSnapshot(supplier) },
    });
    return NextResponse.json({ data: rejected });
  }

  const pending = supplier.pendingChanges as
    | { action?: string; data?: Record<string, unknown>; reason?: string }
    | null;
  const pendingUpdate = pending?.data
    ? updateSupplierSchema.safeParse(pending.data)
    : null;
  if (pending?.action === "Update" && !pendingUpdate?.success) {
    return NextResponse.json(
      { error: "Pending supplier update is no longer valid" },
      { status: 422 }
    );
  }
  const data =
    pending?.action === "Update"
      ? {
          ...(pendingUpdate?.data ?? {}),
          approvalStatus: "Approved" as const,
          pendingChanges: Prisma.JsonNull,
          reviewedById: session.userId,
          reviewedAt: new Date(),
          reviewNotes: reason,
        }
      : pending?.action === "Archive"
        ? {
            deletedAt: new Date(),
            deletedById: session.userId,
            deleteReason: pending.reason ?? reason,
            approvalStatus: "Approved" as const,
            pendingChanges: Prisma.JsonNull,
            reviewedById: session.userId,
            reviewedAt: new Date(),
            reviewNotes: reason,
          }
        : {
          approvalStatus: "Approved" as const,
          pendingChanges: Prisma.JsonNull,
          reviewedById: session.userId,
          reviewedAt: new Date(),
          reviewNotes: reason,
          };

  const approved = await prisma.supplier.update({
    where: { id },
    data,
  });
  await logActivity({
    orgId: session.orgId,
    userId: session.userId,
    action: "approved_supplier_change",
    entityType: "supplier",
    entityId: supplier.id,
    summary: `Approved supplier change for ${approved.name}`,
    metadata: {
      reason,
      before: supplierSnapshot(supplier),
      after: supplierSnapshot(approved),
    },
  });
  return NextResponse.json({ data: approved });
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/suppliers/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
