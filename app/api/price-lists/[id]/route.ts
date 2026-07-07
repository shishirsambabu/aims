import { NextResponse, type NextRequest } from "next/server";

import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPriceListById } from "@/lib/data/sales";

interface Params {
  params: Promise<{ id: string }>;
}

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function redactItems(items: {
  id: string;
  item: string;
  variety: string | null;
  grade: string | null;
  uom: string;
  basePrice: unknown;
  floorPrice: unknown;
  benchmarkPrice: unknown;
  maxDiscountPct: unknown;
  notes: string | null;
}[], canViewFloor: boolean) {
  return items.map((item) => ({
    ...item,
    basePrice: dec(item.basePrice),
    floorPrice: canViewFloor ? dec(item.floorPrice) : null,
    benchmarkPrice: dec(item.benchmarkPrice),
    maxDiscountPct: canViewFloor ? dec(item.maxDiscountPct) : null,
  }));
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "sales.view") && !can(session.role, "price.publish")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const row = await getPriceListById(session.orgId, id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const canViewFloor = can(session.role, "price.floor.view") || can(session.role, "financials.view");
    return NextResponse.json({
      data: {
        ...row,
        priceDate: row.priceDate.toISOString().slice(0, 10),
        publishedAt: row.publishedAt?.toISOString() ?? null,
        items: redactItems(row.items as never, canViewFloor),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/price-lists/:id]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "price.publish")) {
      return NextResponse.json(
        { error: "You do not have permission to manage price lists" },
        { status: 403 }
      );
    }

    const row = await getPriceListById(session.orgId, id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      action?: "publish" | "unpublish" | "archive";
      notes?: string;
    };

    if (!body.action && body.notes == null) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 422 });
    }

    const next = await prisma.priceList.update({
      where: { id: row.id },
      data: {
        notes: body.notes?.trim() ?? row.notes,
        status:
          body.action === "publish"
            ? "Published"
            : body.action === "archive"
              ? "Archived"
              : body.action === "unpublish"
                ? "Draft"
                : undefined,
        publishedAt:
          body.action === "publish"
            ? new Date()
            : body.action === "unpublish"
              ? null
              : row.publishedAt ?? undefined,
        publishedById:
          body.action === "publish"
            ? session.userId
            : body.action === "unpublish"
              ? null
              : row.publishedById ?? undefined,
      },
      include: {
        warehouse: { select: { name: true, code: true } },
        publishedBy: { select: { fullName: true, email: true } },
        items: true,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action:
        body.action === "publish"
          ? "published_price_list"
          : body.action === "archive"
            ? "archived_price_list"
            : body.action === "unpublish"
              ? "unpublished_price_list"
              : "updated_price_list",
      entityType: "price_list",
      entityId: next.id,
      summary:
        body.action === "publish"
          ? `Published price list for ${next.warehouse.name}`
          : body.action === "archive"
            ? `Archived price list for ${next.warehouse.name}`
            : body.action === "unpublish"
              ? `Reverted price list for ${next.warehouse.name} to draft`
              : `Updated price list for ${next.warehouse.name}`,
      metadata: {
        action: body.action ?? "update",
        priceDate: next.priceDate.toISOString().slice(0, 10),
      },
    });

    return NextResponse.json({ data: next });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/price-lists/:id PATCH]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
