import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth";
import { can, canAny } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { findCustomerDuplicate } from "@/lib/customer-controls";
import { getCustomerById } from "@/lib/data/customers";
import {
  customerReviewSchema,
  customerSchema,
} from "@/lib/validations/customer";
import type { Role } from "@/types";

const SALES_REP_ROLES: Role[] = ["sales_executive", "manager", "gm", "admin"];

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!canAny(session.role, ["crm.view", "sales.view", "financials.view"])) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const customer = await getCustomerById(
      session.orgId,
      id,
      session.role === "sales_executive" ? session.userId : undefined
    );
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: customer });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const body = await request.json();

    if (body.action === "approve" || body.action === "reject") {
      return reviewCustomer(id, session, body);
    }

    if (!can(session.role, "crm.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const existing = await prisma.customer.findFirst({
      where: {
        id,
        orgId: session.orgId,
        deletedAt: null,
        ...(session.role === "sales_executive" ? { assignedRepId: session.userId } : {}),
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    if (session.role !== "sales_executive" && !input.assignedRepId) {
      return NextResponse.json(
        { error: "Assigned rep is required before a customer can be submitted" },
        { status: 422 }
      );
    }
    const creditHoldReason =
      typeof body.creditHoldReason === "string" && body.creditHoldReason.trim()
        ? body.creditHoldReason.trim()
        : null;
    if (existing.creditHold !== input.creditHold && !creditHoldReason) {
      return NextResponse.json(
        { error: "A reason is required when changing credit hold" },
        { status: 422 }
      );
    }
    const duplicate = await findCustomerDuplicate(session.orgId, {
      id,
      code: input.code,
      gstin: input.gstin,
      pan: input.pan,
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: "A customer with the same code, GSTIN, or PAN already exists",
          duplicate: {
            id: duplicate.id,
            code: duplicate.code,
            name: duplicate.name,
            gstin: duplicate.gstin,
            pan: duplicate.pan,
          },
        },
        { status: 409 }
      );
    }
    const assignedRepId = await resolveSalesRep(
      session.orgId,
      session.role === "sales_executive" ? session.userId : input.assignedRepId
    );
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...input,
        assignedRepId,
        approvalStatus: "PendingApproval",
        pendingChanges: { action: "Update", data: input, creditHoldReason },
        requestedById: session.userId,
        reviewedById: null,
        reviewedAt: null,
        reviewNotes:
          creditHoldReason ?? "Customer update pending review.",
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "requested_customer_update",
      entityType: "customer",
      entityId: customer.id,
      summary: `Requested update for customer ${customer.name}`,
      metadata: { before: existing, pending: input, reason: creditHoldReason },
    });

    return NextResponse.json({ data: customer });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "crm.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to archive a customer" },
        { status: 422 }
      );
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        orgId: session.orgId,
        deletedAt: null,
        ...(session.role === "sales_executive" ? { assignedRepId: session.userId } : {}),
      },
      include: { _count: { select: { contacts: true, kycDocuments: true } } },
    });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.customer.update({
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
      action: "requested_customer_archive",
      entityType: "customer",
      entityId: customer.id,
      summary: `Requested archive for customer ${customer.name}`,
      metadata: { reason, before: customer },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleError(err);
  }
}

async function reviewCustomer(
  id: string,
  session: Awaited<ReturnType<typeof requireSession>>,
  body: { action?: "approve" | "reject"; reason?: string }
) {
  if (!can(session.role, "crm.kyc.approve") && !can(session.role, "masterdata.approve")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const parsed = customerReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const reason = parsed.data.reason?.trim() || null;

  const customer = await prisma.customer.findFirst({
    where: { id, orgId: session.orgId, deletedAt: null },
  });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (customer.approvalStatus !== "PendingApproval") {
    return NextResponse.json(
      { error: "Customer has no pending approval item" },
      { status: 409 }
    );
  }
  if (customer.requestedById === session.userId) {
    return NextResponse.json(
      { error: "Maker-checker control: the requester cannot approve or reject their own customer change" },
      { status: 409 }
    );
  }

  if (body.action === "reject") {
    const rejected = await prisma.customer.update({
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
      action: "rejected_customer_change",
      entityType: "customer",
      entityId: customer.id,
      summary: `Rejected customer change for ${customer.name}`,
      metadata: { reason, before: customer },
    });
    return NextResponse.json({ data: rejected });
  }

  const pending = customer.pendingChanges as
    | { action?: string; data?: Record<string, unknown>; reason?: string }
    | null;
  const pendingUpdate =
    pending?.data != null ? customerSchema.safeParse(pending.data) : null;
  if (pending?.action === "Update" && !pendingUpdate?.success) {
    return NextResponse.json(
      { error: "Pending customer update is no longer valid" },
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

  const approved = await prisma.customer.update({
    where: { id },
    data,
  });

  await logActivity({
    orgId: session.orgId,
    userId: session.userId,
    action: "approved_customer_change",
    entityType: "customer",
    entityId: customer.id,
    summary: `Approved customer change for ${approved.name}`,
    metadata: { reason, before: customer, after: approved },
  });

  return NextResponse.json({ data: approved });
}

async function resolveSalesRep(orgId: string, assignedRepId: string | undefined) {
  if (!assignedRepId) return undefined;
  const rep = await prisma.user.findFirst({
    where: {
      id: assignedRepId,
      orgId,
      isActive: true,
      role: { in: SALES_REP_ROLES },
    },
    select: { id: true },
  });
  if (!rep) {
    throw new Error("INVALID_ASSIGNED_REP");
  }
  return rep.id;
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof Error && err.message === "INVALID_ASSIGNED_REP") {
    return NextResponse.json(
      { error: "Assigned rep must be an active sales user in this organisation" },
      { status: 422 }
    );
  }
  console.error("[api/customers/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
