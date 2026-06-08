import "server-only";

import { prisma } from "@/lib/prisma";

export interface NavCounts {
  expiringDocs: number;
  pendingPayments: number;
  flaggedContainers: number;
}

/** Counts for sidebar notification badges. Safe-fails to zeros. */
export async function getNavCounts(orgId: string): Promise<NavCounts> {
  try {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    const [expiringDocs, pendingPayments, flaggedContainers] =
      await Promise.all([
        prisma.document.count({
          where: { orgId, expiryDate: { not: null, lte: in30 } },
        }),
        prisma.payment.count({
          where: { orgId, status: { not: "Paid" } },
        }),
        prisma.container.count({ where: { orgId, flagged: true } }),
      ]);

    return { expiringDocs, pendingPayments, flaggedContainers };
  } catch {
    return { expiringDocs: 0, pendingPayments: 0, flaggedContainers: 0 };
  }
}
