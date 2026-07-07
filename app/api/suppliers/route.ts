import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { listSuppliers } from "@/lib/data/suppliers";
import { createSupplierSchema } from "@/lib/validations/supplier";

export async function GET() {
  try {
    const session = await requireSession();
    if (
      !can(session.role, "container.view") &&
      !can(session.role, "doc.view") &&
      !can(session.role, "masterdata.write")
    ) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    return NextResponse.json({ data: await listSuppliers(session.orgId) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write")) {
      return NextResponse.json(
        { error: "You do not have permission to manage suppliers" },
        { status: 403 }
      );
    }
    const parsed = createSupplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const input = parsed.data;

    const existing = await prisma.supplier.findFirst({
      where: { orgId: session.orgId, name: input.name, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A supplier with this name already exists" },
        { status: 409 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        orgId: session.orgId,
        ...input,
        approvalStatus: "PendingApproval",
        requestedById: session.userId,
        reviewNotes: "New supplier pending master-data approval.",
      },
    });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "requested_supplier_create",
      entityType: "supplier",
      entityId: supplier.id,
      summary: `Requested supplier ${supplier.name}`,
      metadata: { after: supplier },
    });
    return NextResponse.json({ data: supplier }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/suppliers]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
