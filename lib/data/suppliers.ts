import "server-only";

import { prisma } from "@/lib/prisma";
import type { ApprovalStatus } from "@/types";

export interface SupplierRecord {
  id: string;
  name: string;
  country: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  containerCount: number;
  approvalStatus: ApprovalStatus;
  pendingChanges: unknown;
  reviewNotes: string | null;
}

export async function listSuppliers(orgId: string): Promise<SupplierRecord[]> {
  const rows = await prisma.supplier.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { containers: true } } },
  });
  return rows.map((s: {
    id: string;
    name: string;
    country: string | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    approvalStatus: ApprovalStatus;
    pendingChanges: unknown;
    reviewNotes: string | null;
    _count: { containers: number };
  }) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    containerCount: s._count.containers,
    approvalStatus: s.approvalStatus,
    pendingChanges: s.pendingChanges,
    reviewNotes: s.reviewNotes,
  }));
}
