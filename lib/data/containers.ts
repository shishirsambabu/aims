import "server-only";

import { prisma } from "@/lib/prisma";
import { PORTS } from "@/lib/constants";
import type { ContainerStatus } from "@/types";

export interface ContainerFilters {
  q?: string;
  port?: string;
  supplierId?: string;
  status?: ContainerStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface ContainerListOptions {
  includeFinancials?: boolean;
}

type ContainerWhere = NonNullable<
  Parameters<typeof prisma.container.findMany>[0]
>["where"];

export interface ContainerListRow {
  id: string;
  slNo: number | null;
  containerNo: string;
  blNo: string;
  supplierName: string | null;
  port: string | null;
  item: string | null;
  noOfBoxes: number | null;
  status: ContainerStatus;
  eta: string | null;
  saleValue: number | null;
  profit: number | null;
  marginPct: number | null;
  flagged: boolean;
  docScore: number; // distinct verified mandatory document types present (out of 8)
}

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/** Builds the org-scoped Prisma where clause from filters. */
function buildWhere(
  orgId: string,
  filters: ContainerFilters
): ContainerWhere {
  const where = { orgId, deletedAt: null } as NonNullable<ContainerWhere>;

  if (filters.q) {
    // Search spans Container No AND BL No simultaneously.
    where.OR = [
      { containerNo: { contains: filters.q, mode: "insensitive" } },
      { blNo: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.port) {
    // Containers may store the port name ("Bangalore") or its code ("INENR1"),
    // so match either for the selected port.
    const def = PORTS.find(
      (p) => p.name === filters.port || p.code === filters.port
    );
    where.port = def ? { in: [def.name, def.code] } : filters.port;
  }
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.status) where.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    where.eta = {};
    if (filters.dateFrom) where.eta.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.eta.lte = new Date(filters.dateTo);
  }
  return where;
}

export async function listContainers(
  orgId: string,
  filters: ContainerFilters = {},
  options: ContainerListOptions = {}
): Promise<ContainerListRow[]> {
  const includeFinancials = options.includeFinancials ?? false;
  const rows = await prisma.container.findMany({
    where: buildWhere(orgId, filters),
    orderBy: [{ slNo: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slNo: true,
      containerNo: true,
      blNo: true,
      port: true,
      item: true,
      noOfBoxes: true,
      status: true,
      eta: true,
      flagged: true,
      supplier: { select: { name: true } },
      documents: {
        where: { deletedAt: null },
        select: { type: true, status: true },
      },
      ...(includeFinancials
        ? {
            sale: {
              select: {
                saleValue: true,
                profit: true,
                marginPct: true,
                approvalStatus: true,
              },
            },
          }
        : {}),
    },
  });

  return rows.map((r: {
    id: string;
    slNo: number | null;
    containerNo: string;
    blNo: string;
    port: string | null;
    item: string | null;
    noOfBoxes: number | null;
    status: ContainerStatus;
    eta: Date | null;
    flagged: boolean;
    supplier: { name: string } | null;
      sale?: {
      saleValue: unknown;
      profit: unknown;
      marginPct: unknown;
      approvalStatus: string;
    } | null;
    documents: { type: string; status: string }[];
  }) => ({
    id: r.id,
    slNo: r.slNo,
    containerNo: r.containerNo,
    blNo: r.blNo,
    supplierName: r.supplier?.name ?? null,
    port: r.port,
    item: r.item,
    noOfBoxes: r.noOfBoxes,
    status: r.status as ContainerStatus,
    eta: r.eta ? r.eta.toISOString() : null,
    saleValue:
      includeFinancials && r.sale?.approvalStatus === "Approved"
        ? dec(r.sale.saleValue)
        : null,
    profit:
      includeFinancials && r.sale?.approvalStatus === "Approved"
        ? dec(r.sale.profit)
        : null,
    marginPct:
      includeFinancials && r.sale?.approvalStatus === "Approved"
        ? dec(r.sale.marginPct)
        : null,
    flagged: r.flagged,
    docScore: new Set(
      r.documents.filter((d) => d.status === "Verified").map((d) => d.type)
    ).size,
  }));
}

export async function getContainerById(
  orgId: string,
  id: string,
  options: ContainerListOptions = {}
) {
  const includeFinancials = options.includeFinancials ?? false;
  return prisma.container.findFirst({
    where: { id, orgId, deletedAt: null },
    include: {
      supplier: true,
      shipmentItem: true,
      ...(includeFinancials ? { cost: true, sale: true } : {}),
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      ...(includeFinancials
        ? {
            payments: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
            },
          }
        : {}),
    },
  });
}

export async function getContainerActivity(orgId: string, containerId: string) {
  return prisma.activityLog.findMany({
    where: { orgId, entityType: "container", entityId: containerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { fullName: true, email: true } } },
  });
}

/** Returns the next Sl No for a new container in the org. */
export async function nextSlNo(orgId: string): Promise<number> {
  const max = await prisma.container.aggregate({
    where: { orgId },
    _max: { slNo: true },
  });
  return (max._max.slNo ?? 0) + 1;
}
