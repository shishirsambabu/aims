import "server-only";

import { prisma } from "@/lib/prisma";
import type { StockUom } from "@prisma/client";

export interface ItemRow {
  id: string;
  code: string;
  name: string;
  variety: string | null;
  grade: string | null;
  hsnCode: string | null;
  defaultUom: StockUom;
  packSpec: string | null;
  description: string | null;
  isActive: boolean;
  containerCount: number;
  stockLotCount: number;
  priceLineCount: number;
}

export interface ItemFilters {
  q?: string;
  includeInactive?: boolean;
}

export async function listItems(
  orgId: string,
  filters: ItemFilters = {}
): Promise<ItemRow[]> {
  const rows = await prisma.item.findMany({
    where: {
      orgId,
      deletedAt: null,
      ...(filters.includeInactive ? {} : { isActive: true }),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { code: { contains: filters.q, mode: "insensitive" } },
              { variety: { contains: filters.q, mode: "insensitive" } },
              { hsnCode: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { containers: true, stockItems: true, priceListItems: true },
      },
    },
  });

  return rows.map((row: (typeof rows)[number]) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    variety: row.variety,
    grade: row.grade,
    hsnCode: row.hsnCode,
    defaultUom: row.defaultUom,
    packSpec: row.packSpec,
    description: row.description,
    isActive: row.isActive,
    containerCount: row._count.containers,
    stockLotCount: row._count.stockItems,
    priceLineCount: row._count.priceListItems,
  }));
}

/** Next free ITM-XXXX code for the org (backfill used the same series). */
export async function nextItemCode(orgId: string): Promise<string> {
  const last = await prisma.item.findFirst({
    where: { orgId, code: { startsWith: "ITM-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNum = last ? Number(last.code.replace("ITM-", "")) : 0;
  const next = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  return `ITM-${String(next).padStart(4, "0")}`;
}
