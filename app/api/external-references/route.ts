import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listExternalReferences, resolveEntityLabel } from "@/lib/data/integrations";

const createSchema = z.object({
  provider: z.string().min(2),
  entityType: z.enum(["container", "warehouse", "customer", "sales_order", "customer_receipt"]),
  entityKey: z.string().min(1),
  externalId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json({ error: "You do not have permission to view mappings" }, { status: 403 });
    }
    const rows = await listExternalReferences(session.orgId);
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider")?.trim().toLowerCase();
    const entityType = url.searchParams.get("entityType")?.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (provider && row.provider.toLowerCase() !== provider) return false;
      if (entityType && row.entityType.toLowerCase() !== entityType) return false;
      return true;
    });
    return NextResponse.json({ data: filtered });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json({ error: "You do not have permission to manage mappings" }, { status: 403 });
    }
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
    }

    const input = parsed.data;
    const entity = await resolveEntity(session.orgId, input.entityType, input.entityKey);
    if (!entity) {
      return NextResponse.json({ error: "Could not resolve the local record from the given key" }, { status: 404 });
    }

    const row = await prisma.externalReference.upsert({
      where: {
        orgId_provider_entityType_entityId: {
          orgId: session.orgId,
          provider: input.provider.trim(),
          entityType: input.entityType,
          entityId: entity.id,
        },
      },
      create: {
        orgId: session.orgId,
        provider: input.provider.trim(),
        entityType: input.entityType,
        entityId: entity.id,
        externalId: input.externalId.trim(),
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
      },
      update: {
        externalId: input.externalId.trim(),
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "upserted_external_reference",
      entityType: "external_reference",
      entityId: row.id,
      summary: `Mapped ${entity.label} to ${input.provider}:${input.externalId}`,
      metadata: {
        provider: input.provider,
        entityType: input.entityType,
        entityId: entity.id,
        externalId: input.externalId,
      },
    });

    return NextResponse.json(
      {
        data: {
          ...row,
          entityLabel: entity.label,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

async function resolveEntity(orgId: string, entityType: string, entityKey: string) {
  const key = entityKey.trim();
  if (!key) return null;

  if (entityType === "container") {
    const row = await prisma.container.findFirst({
      where: {
        orgId,
        deletedAt: null,
        OR: [{ id: key }, { containerNo: key }, { blNo: key }],
      },
      select: { id: true, containerNo: true, blNo: true },
    });
    if (row) return { id: row.id, label: `${row.containerNo} · BL ${row.blNo}` };
  }

  if (entityType === "warehouse") {
    const row = await prisma.warehouse.findFirst({
      where: {
        orgId,
        deletedAt: null,
        OR: [{ id: key }, { code: key }, { name: { equals: key, mode: "insensitive" } }],
      },
      select: { id: true, name: true, code: true, city: true },
    });
    if (row) return { id: row.id, label: `${row.name} (${row.code}) · ${row.city}` };
  }

  if (entityType === "customer") {
    const row = await prisma.customer.findFirst({
      where: {
        orgId,
        deletedAt: null,
        OR: [{ id: key }, { code: key }, { name: { equals: key, mode: "insensitive" } }],
      },
      select: { id: true, code: true, name: true },
    });
    if (row) return { id: row.id, label: `${row.code} · ${row.name}` };
  }

  if (entityType === "sales_order") {
    const row = await prisma.salesOrder.findFirst({
      where: {
        orgId,
        OR: [{ id: key }, { orderNo: key }],
      },
      select: { id: true, orderNo: true },
    });
    if (row) return { id: row.id, label: row.orderNo };
  }

  if (entityType === "customer_receipt") {
    const row = await prisma.customerReceipt.findFirst({
      where: {
        orgId,
        deletedAt: null,
        OR: [{ id: key }, { receiptNo: key }],
      },
      select: { id: true, receiptNo: true },
    });
    if (row) return { id: row.id, label: row.receiptNo };
  }

  return null;
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/external-references]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
