import "server-only";

import { prisma } from "@/lib/prisma";

export interface SupplierRecord {
  id: string;
  name: string;
  country: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  containerCount: number;
}

export async function listSuppliers(orgId: string): Promise<SupplierRecord[]> {
  const rows = await prisma.supplier.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    include: { _count: { select: { containers: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    containerCount: s._count.containers,
  }));
}
