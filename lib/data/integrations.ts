import "server-only";

import { prisma } from "@/lib/prisma";

export interface IntegrationConnectionRow {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  lastTestAt: string | null;
  errorMessage: string | null;
  runs: {
    id: string;
    status: string;
    mode: string;
    summary: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
  }[];
  errors: {
    id: string;
    message: string;
    severity: string;
    createdAt: string;
  }[];
}

export interface ExternalReferenceRow {
  id: string;
  provider: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  externalId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export async function listIntegrationConnections(orgId: string): Promise<IntegrationConnectionRow[]> {
  const rows = await prisma.integrationConnection.findMany({
    where: { orgId },
    orderBy: { provider: "asc" },
    include: {
      runs: { orderBy: { createdAt: "desc" }, take: 5 },
      errors: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    name: row.name,
    status: row.status,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    lastTestAt: row.lastTestAt ? row.lastTestAt.toISOString() : null,
    errorMessage: row.errorMessage,
    runs: row.runs.map((run) => ({
      id: run.id,
      status: run.status,
      mode: run.mode,
      summary: run.summary,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    })),
    errors: row.errors.map((error) => ({
      id: error.id,
      message: error.message,
      severity: error.severity,
      createdAt: error.createdAt.toISOString(),
    })),
  }));
}

export async function listExternalReferences(orgId: string): Promise<ExternalReferenceRow[]> {
  const rows = await prisma.externalReference.findMany({
    where: { orgId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const labels = await Promise.all(
    rows.map(async (row) => ({
      row,
      label: await resolveEntityLabel(orgId, row.entityType, row.entityId),
    }))
  );

  return labels.map(({ row, label }) => ({
    id: row.id,
    provider: row.provider,
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: label,
    externalId: row.externalId,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function resolveEntityLabel(orgId: string, entityType: string, entityId: string): Promise<string> {
  if (entityType === "container") {
    const row = await prisma.container.findFirst({
      where: { id: entityId, orgId, deletedAt: null },
      select: { containerNo: true, blNo: true },
    });
    if (row) return `${row.containerNo} · BL ${row.blNo}`;
  }
  if (entityType === "warehouse") {
    const row = await prisma.warehouse.findFirst({
      where: { id: entityId, orgId, deletedAt: null },
      select: { name: true, code: true, city: true },
    });
    if (row) return `${row.name} (${row.code}) · ${row.city}`;
  }
  if (entityType === "customer") {
    const row = await prisma.customer.findFirst({
      where: { id: entityId, orgId, deletedAt: null },
      select: { code: true, name: true },
    });
    if (row) return `${row.code} · ${row.name}`;
  }
  if (entityType === "sales_order") {
    const row = await prisma.salesOrder.findFirst({
      where: { id: entityId, orgId },
      select: { orderNo: true },
    });
    if (row) return row.orderNo;
  }
  if (entityType === "customer_receipt") {
    const row = await prisma.customerReceipt.findFirst({
      where: { id: entityId, orgId, deletedAt: null },
      select: { receiptNo: true },
    });
    if (row) return row.receiptNo;
  }
  return entityId;
}
