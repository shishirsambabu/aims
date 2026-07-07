import "server-only";

import type { Prisma } from "@prisma/client";

import { computeProfit } from "@/lib/finance";

export async function recomputeContainerSalesFromDispatch(
  tx: Prisma.TransactionClient,
  orgId: string,
  userId: string,
  containerIds: string[]
): Promise<void> {
  const uniqueIds = [...new Set(containerIds)];
  for (const containerId of uniqueIds) {
    const [container, stockRows, dispatchedLines] = await Promise.all([
      tx.container.findFirst({
        where: { id: containerId, orgId },
        select: { id: true, cost: { select: { totalCost: true } } },
      }),
      tx.stockItem.findMany({
        where: { orgId, containerId, deletedAt: null },
        select: { qtyAvailable: true, qtyReserved: true, qtySold: true },
      }),
      tx.gatePassLine.findMany({
        where: {
          orgId,
          qtyDispatched: { gt: 0 },
          stockItem: { containerId },
          gatePass: {
            salesOrderId: { not: null },
            status: { in: ["PartiallyDispatched", "Dispatched"] },
          },
        },
        select: {
          stockItemId: true,
          qtyDispatched: true,
          gatePass: {
            select: {
              salesOrder: {
                select: {
                  lines: {
                    select: { stockItemId: true, qty: true, lineTotal: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    if (!container || stockRows.length === 0) continue;

    let soldQty = 0;
    let saleValue = 0;
    for (const dispatchLine of dispatchedLines) {
      const orderLines = dispatchLine.gatePass.salesOrder?.lines.filter(
        (line) => line.stockItemId === dispatchLine.stockItemId
      ) ?? [];
      const orderedQty = orderLines.reduce((sum, line) => sum + Number(line.qty), 0);
      const orderedValue = orderLines.reduce((sum, line) => sum + Number(line.lineTotal), 0);
      const dispatchQty = Number(dispatchLine.qtyDispatched);
      soldQty += dispatchQty;
      saleValue += orderedQty > 0 ? dispatchQty * (orderedValue / orderedQty) : 0;
    }

    if (soldQty > 0) {
      const existing = await tx.sale.findUnique({ where: { containerId } });
      const damageQty = Number(existing?.damageQty ?? 0);
      const damageValue = Number(existing?.damageValue ?? 0);
      const profit = computeProfit(
        { soldQty, saleValue, damageValue },
        Number(container.cost?.totalCost ?? 0)
      );
      await tx.sale.upsert({
        where: { containerId },
        create: {
          orgId,
          containerId,
          soldQty,
          avgPrice: saleValue / soldQty,
          saleValue,
          damageQty,
          damageValue,
          profit: profit.profit,
          profitPerBox: profit.profitPerBox,
          marginPct: profit.marginPct,
          approvalStatus: "Approved",
          reviewedById: userId,
          reviewedAt: new Date(),
          reviewNotes: "System-recognized from dispatched sales orders",
        },
        update: {
          soldQty,
          avgPrice: saleValue / soldQty,
          saleValue,
          profit: profit.profit,
          profitPerBox: profit.profitPerBox,
          marginPct: profit.marginPct,
          approvalStatus: "Approved",
          reviewedById: userId,
          reviewedAt: new Date(),
          reviewNotes: "System-recognized from dispatched sales orders",
        },
      });
    }

    const totalSold = stockRows.reduce((sum, row) => sum + Number(row.qtySold), 0);
    const allClosed = stockRows.every(
      (row) => Number(row.qtyAvailable) === 0 && Number(row.qtyReserved) === 0
    );
    await tx.container.update({
      where: { id: containerId },
      data: { status: totalSold <= 0 ? "InWarehouse" : allClosed ? "FullySold" : "PartiallySold" },
    });
  }
}
