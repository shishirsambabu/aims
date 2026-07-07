import { NextResponse, type NextRequest } from "next/server";

import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listPriceLists } from "@/lib/data/sales";
import { normalizeDay } from "@/lib/data/sales";
import { priceListSchema } from "@/lib/validations/sales";

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "sales.view") && !can(session.role, "price.publish")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const data = await listPriceLists(session.orgId);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/price-lists]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "price.publish")) {
      return NextResponse.json(
        { error: "You do not have permission to manage price lists" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const publish = body.publish === true;
    const parsed = priceListSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const priceDate = normalizeDay(input.priceDate);
    const existing = await prisma.priceList.findUnique({
      where: {
        orgId_warehouseId_priceDate: {
          orgId: session.orgId,
          warehouseId: input.warehouseId,
          priceDate,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A price list already exists for this warehouse and date" },
        { status: 409 }
      );
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, orgId: session.orgId, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    const created = await prisma.priceList.create({
      data: {
        orgId: session.orgId,
        warehouseId: input.warehouseId,
        priceDate,
        notes: input.notes ?? null,
        status: publish ? "Published" : "Draft",
        publishedAt: publish ? new Date() : undefined,
        publishedById: publish ? session.userId : undefined,
        items: {
          create: input.items.map((item) => ({
            orgId: session.orgId,
            item: item.item,
            variety: item.variety ?? null,
            grade: item.grade ?? null,
            uom: item.uom,
            basePrice: item.basePrice,
            floorPrice: item.floorPrice,
            benchmarkPrice: item.benchmarkPrice ?? null,
            maxDiscountPct: item.maxDiscountPct ?? null,
            notes: item.notes ?? null,
          })),
        },
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
      action: publish ? "published_price_list" : "created_price_list",
      entityType: "price_list",
      entityId: created.id,
      summary: `${publish ? "Published" : "Created"} price list for ${warehouse.name} on ${priceDate.toISOString().slice(0, 10)}`,
      metadata: {
        warehouseId: warehouse.id,
        warehouseCode: warehouse.code,
        itemCount: created.items.length,
        published: publish,
      },
    });

    return NextResponse.json({ data: created });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/price-lists POST]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
