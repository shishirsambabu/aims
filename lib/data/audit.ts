import "server-only";

import { prisma } from "@/lib/prisma";

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  createdAt: string;
  user: string | null;
}

export async function listAudit(
  orgId: string,
  limit = 200
): Promise<AuditEntry[]> {
  const rows = await prisma.activityLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { fullName: true, email: true } } },
  });
  return rows.map(
    (r: {
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      summary: string | null;
      createdAt: Date;
      user: { fullName: string | null; email: string } | null;
    }) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    createdAt: r.createdAt.toISOString(),
    user: r.user?.fullName || r.user?.email || null,
    })
  );
}
