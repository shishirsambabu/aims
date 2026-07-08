import "server-only";

import { prisma } from "@/lib/prisma";
import { istDayBoundary } from "@/lib/dates";
import type { DocumentStatus, DocumentType } from "@/types";

export interface DocumentFilters {
  q?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  containerId?: string;
  expiringSoon?: boolean; // expiry within 30 days
}

export interface DocumentRow {
  id: string;
  type: DocumentType;
  docNo: string | null;
  containerId: string;
  containerNo: string | null;
  blNo: string | null;
  supplierName: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: DocumentStatus;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
}

type DocumentWhere = NonNullable<
  Parameters<typeof prisma.document.findMany>[0]
>["where"];

function buildWhere(
  orgId: string,
  filters: DocumentFilters
): DocumentWhere {
  const where = { orgId, deletedAt: null } as NonNullable<DocumentWhere>;

  if (filters.q) {
    where.OR = [
      { containerNo: { contains: filters.q, mode: "insensitive" } },
      { blNo: { contains: filters.q, mode: "insensitive" } },
      { docNo: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.containerId) where.containerId = filters.containerId;
  if (filters.expiringSoon) {
    // 30 business days from IST midnight, not server-UTC midnight.
    where.expiryDate = { not: null, lte: istDayBoundary(30) };
  }
  return where;
}

export interface DocumentListOptions {
  /** 1-based page number; when set, results are paginated. */
  page?: number;
  pageSize?: number;
}

export async function countDocuments(
  orgId: string,
  filters: DocumentFilters = {}
): Promise<number> {
  return prisma.document.count({ where: buildWhere(orgId, filters) });
}

export async function listDocuments(
  orgId: string,
  filters: DocumentFilters = {},
  options: DocumentListOptions = {}
): Promise<DocumentRow[]> {
  const pagination: { skip?: number; take?: number } = {};
  if (options.page != null) {
    const pageSize = options.pageSize ?? 50;
    pagination.skip = (options.page - 1) * pageSize;
    pagination.take = pageSize;
  }
  const rows = await prisma.document.findMany({
    where: buildWhere(orgId, filters),
    ...pagination,
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      docNo: true,
      containerId: true,
      containerNo: true,
      blNo: true,
      supplierName: true,
      issueDate: true,
      expiryDate: true,
      status: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
    },
  });

  return rows.map((r: {
    id: string;
    type: DocumentType;
    docNo: string | null;
    containerId: string;
    containerNo: string | null;
    blNo: string | null;
    supplierName: string | null;
    issueDate: Date | null;
    expiryDate: Date | null;
    status: DocumentStatus;
    fileUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
  }) => ({
    id: r.id,
    type: r.type as DocumentType,
    docNo: r.docNo,
    containerId: r.containerId,
    containerNo: r.containerNo,
    blNo: r.blNo,
    supplierName: r.supplierName,
    issueDate: r.issueDate ? r.issueDate.toISOString() : null,
    expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
    status: r.status as DocumentStatus,
    fileUrl: r.fileUrl,
    fileName: r.fileName,
    fileSize: r.fileSize,
  }));
}

/** Lightweight container options for the upload picker (Container No + BL No). */
export async function containerOptions(orgId: string) {
  return prisma.container.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      containerNo: true,
      blNo: true,
      supplier: { select: { name: true } },
    },
  });
}

/** Count of documents expiring within 30 days — for nav/badges. */
export async function expiringCount(orgId: string): Promise<number> {
  return prisma.document.count({
    where: { orgId, deletedAt: null, expiryDate: { not: null, lte: istDayBoundary(30) } },
  });
}
