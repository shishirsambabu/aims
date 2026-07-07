import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can, canAny } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { findCustomerDuplicate } from "@/lib/customer-controls";
import { listCustomers } from "@/lib/data/customers";
import { customerSchema } from "@/lib/validations/customer";
import type { Role } from "@/types";

const SALES_REP_ROLES: Role[] = ["sales_executive", "manager", "gm", "admin"];

export async function GET() {
  try {
    const session = await requireSession();
    if (!canAny(session.role, ["crm.view", "sales.view", "financials.view"])) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    return NextResponse.json({
      data: await listCustomers(
        session.orgId,
        session.role === "sales_executive" ? session.userId : undefined
      ),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "crm.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
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
    if (input.creditHold && !creditHoldReason) {
      return NextResponse.json(
        { error: "Credit hold reason is required when opening a held customer" },
        { status: 422 }
      );
    }
    const assignedRepId = await resolveSalesRep(
      session.orgId,
      session.role === "sales_executive" ? session.userId : input.assignedRepId
    );
    const existing = await prisma.customer.findFirst({
      where: { orgId: session.orgId, code: input.code, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A customer with this code already exists" },
        { status: 409 }
      );
    }

    const duplicate = await findCustomerDuplicate(session.orgId, input);
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

    const customer = await prisma.customer.create({
      data: {
        orgId: session.orgId,
        ...input,
        assignedRepId,
        approvalStatus: "PendingApproval",
        pendingChanges: { action: "Create", data: input, creditHoldReason },
        requestedById: session.userId,
        reviewNotes: creditHoldReason ?? "Customer master pending review.",
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "requested_customer_create",
      entityType: "customer",
      entityId: customer.id,
      summary: `Requested customer ${customer.name}`,
      metadata: { after: customer, reason: creditHoldReason },
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
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
  console.error("[api/customers]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
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
