import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { updateSupplierSchema } from "@/lib/validations/supplier";

interface Params {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const existing = await prisma.supplier.findFirst({
      where: { id: params.id, orgId: session.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = updateSupplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: parsed.data,
    });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_supplier",
      entityType: "supplier",
      entityId: supplier.id,
      summary: `Updated supplier ${supplier.name}`,
    });
    return NextResponse.json({ data: supplier });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const supplier = await prisma.supplier.findFirst({
      where: { id: params.id, orgId: session.orgId, deletedAt: null },
      select: { id: true, name: true, _count: { select: { containers: true } } },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (supplier._count.containers > 0) {
      return NextResponse.json(
        {
          error: `Can't delete — ${supplier._count.containers} container(s) use this supplier`,
        },
        { status: 409 }
      );
    }
    await prisma.supplier.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
        deleteReason: "Archived from supplier master data",
      },
    });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "archived_supplier",
      entityType: "supplier",
      entityId: supplier.id,
      summary: `Archived supplier ${supplier.name}`,
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
  console.error("[api/suppliers/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
