import { NextResponse, type NextRequest } from "next/server";

import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json({ error: "You do not have permission to delete mappings" }, { status: 403 });
    }

    const existing = await prisma.externalReference.findFirst({
      where: { id, orgId: session.orgId },
      select: { id: true, provider: true, entityType: true, entityId: true, externalId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    await prisma.externalReference.delete({ where: { id: existing.id } });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "deleted_external_reference",
      entityType: "external_reference",
      entityId: existing.id,
      summary: `Deleted mapping ${existing.provider}:${existing.externalId}`,
      metadata: {
        provider: existing.provider,
        entityType: existing.entityType,
        entityId: existing.entityId,
        externalId: existing.externalId,
      },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/external-references/:id]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
