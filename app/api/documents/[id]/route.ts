import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { updateDocumentSchema } from "@/lib/validations/document";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "doc.verify")) {
      return NextResponse.json(
        { error: "You do not have permission to edit documents" },
        { status: 403 }
      );
    }

    const existing = await prisma.document.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true, containerId: true, type: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = updateDocumentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const doc = await prisma.document.update({
      where: { id },
      data: parsed.data,
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_document",
      entityType: "container",
      entityId: existing.containerId,
      summary: parsed.data.status
        ? `Document marked ${parsed.data.status}`
        : "Document updated",
    });

    return NextResponse.json({ data: doc });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "doc.write")) {
      return NextResponse.json(
        { error: "You do not have permission to delete documents" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required to archive a document" },
        { status: 422 }
      );
    }

    const existing = await prisma.document.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true, containerId: true, type: true, status: true, docNo: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.document.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: session.userId,
        deleteReason: reason,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "archived_document",
      entityType: "container",
      entityId: existing.containerId,
      summary: "Document archived",
      metadata: { reason, before: existing },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/documents/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
