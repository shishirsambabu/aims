import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { listItems, nextItemCode } from "@/lib/data/items";
import { createItemSchema } from "@/lib/validations/item";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const sp = request.nextUrl.searchParams;
    const rows = await listItems(session.orgId, {
      q: sp.get("q") ?? undefined,
      includeInactive: sp.get("includeInactive") === "1",
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.code) body.code = await nextItemCode(session.orgId);
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const duplicate = await prisma.item.findFirst({
      where: {
        orgId: session.orgId,
        deletedAt: null,
        OR: [
          { code: parsed.data.code },
          { name: { equals: parsed.data.name, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, name: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `An item with this code or name already exists (${duplicate.code} · ${duplicate.name})` },
        { status: 409 }
      );
    }

    const item = await prisma.item.create({
      data: { orgId: session.orgId, ...parsed.data },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "created_item",
      entityType: "item",
      entityId: item.id,
      summary: `Item ${item.code} · ${item.name}`,
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/items]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
