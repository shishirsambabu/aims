import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listStockMovements } from "@/lib/data/stock";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    if (!can(session.role, "inventory.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const { id } = await params;

    const stockItem = await prisma.stockItem.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!stockItem) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }

    const data = await listStockMovements(session.orgId, stockItem.id);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/warehouse-stock/[id]/movements]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
