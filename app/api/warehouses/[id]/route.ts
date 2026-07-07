import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { updateWarehouseSchema } from "@/lib/validations/warehouse";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const existing = await prisma.warehouse.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = updateWarehouseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: input,
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated",
      entityType: "warehouse",
      entityId: warehouse.id,
      summary: `Updated warehouse ${existing.code}`,
      metadata: { before: existing, after: warehouse },
    });

    return NextResponse.json({ data: warehouse });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const existing = await prisma.warehouse.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const warehouse = await prisma.warehouse.update({
      where: { id: existing.id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "deactivated",
      entityType: "warehouse",
      entityId: warehouse.id,
      summary: `Deactivated warehouse ${warehouse.code}`,
    });

    return NextResponse.json({ data: warehouse });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/warehouses/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
