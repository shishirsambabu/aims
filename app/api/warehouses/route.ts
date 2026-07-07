import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { createWarehouseSchema } from "@/lib/validations/warehouse";
import { listWarehouses } from "@/lib/data/warehouses";

export async function GET() {
  try {
    const session = await requireSession();
    if (
      !can(session.role, "inventory.view") &&
      !can(session.role, "warehouse.assign") &&
      !can(session.role, "sales.view")
    ) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    return NextResponse.json({ data: await listWarehouses(session.orgId) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = createWarehouseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const existing = await prisma.warehouse.findFirst({
      where: { orgId: session.orgId, code: input.code, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A warehouse with this code already exists" },
        { status: 409 }
      );
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        orgId: session.orgId,
        ...input,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "created",
      entityType: "warehouse",
      entityId: warehouse.id,
      summary: `Created warehouse ${warehouse.code} - ${warehouse.name}`,
      metadata: { after: warehouse },
    });

    return NextResponse.json({ data: warehouse }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/warehouses]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
