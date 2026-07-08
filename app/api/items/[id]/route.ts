import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { updateItemSchema } from "@/lib/validations/item";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const { id } = await context.params;

    const existing = await prisma.item.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const parsed = updateItemSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    if (parsed.data.name || parsed.data.code) {
      const duplicate = await prisma.item.findFirst({
        where: {
          orgId: session.orgId,
          deletedAt: null,
          id: { not: id },
          OR: [
            ...(parsed.data.code ? [{ code: parsed.data.code }] : []),
            ...(parsed.data.name
              ? [{ name: { equals: parsed.data.name, mode: "insensitive" as const } }]
              : []),
          ],
        },
        select: { code: true, name: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `Another item already uses this code or name (${duplicate.code} · ${duplicate.name})` },
          { status: 409 }
        );
      }
    }

    const item = await prisma.item.update({
      where: { id },
      data: parsed.data,
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: parsed.data.isActive === false ? "deactivated_item" : "updated_item",
      entityType: "item",
      entityId: item.id,
      summary: `Item ${item.code} · ${item.name}`,
    });

    return NextResponse.json({ data: item });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/items/[id]]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
