import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { writeActivity } from "@/lib/activity";

export async function releaseExpiredReservations(orgId?: string): Promise<number> {
  const expired = await prisma.salesOrder.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      status: "PendingApproval",
      reservationExpiresAt: { lte: new Date() },
    },
    select: { id: true },
  });

  let releasedCount = 0;
  for (const candidate of expired) {
    const released = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: candidate.id },
        include: { lines: true },
      });
      if (!order || order.status !== "PendingApproval" || !order.reservationExpiresAt || order.reservationExpiresAt > new Date()) {
        return false;
      }

      const claimed = await tx.salesOrder.updateMany({
        where: {
          id: order.id,
          status: "PendingApproval",
          reservationExpiresAt: { lte: new Date() },
        },
        data: {
          status: "Cancelled",
          approvalStatus: "Rejected",
          cancelledAt: new Date(),
          reviewNotes: "Reservation expired automatically",
          reservationExpiresAt: null,
        },
      });
      if (claimed.count !== 1) return false;

      for (const line of order.lines) {
        const stock = await tx.stockItem.updateMany({
          where: { id: line.stockItemId, orgId: order.orgId, qtyReserved: { gte: line.qty } },
          data: {
            qtyAvailable: { increment: line.qty },
            qtyReserved: { decrement: line.qty },
          },
        });
        if (stock.count !== 1) throw new Error("EXPIRED_RESERVATION_STATE_CONFLICT");
        await tx.stockMovement.create({
          data: {
            orgId: order.orgId,
            stockItemId: line.stockItemId,
            kind: "Release",
            qty: line.qty,
            uom: line.uom,
            reason: `Reservation expired for sales order ${order.orderNo}`,
            refType: "SalesOrderExpiry",
            refId: order.id,
          },
        });
      }

      await writeActivity(tx, {
        orgId: order.orgId,
        action: "expired_sales_order_reservation",
        entityType: "sales_order",
        entityId: order.id,
        summary: `Released expired reservation for ${order.orderNo}`,
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (released) releasedCount += 1;
  }
  return releasedCount;
}
