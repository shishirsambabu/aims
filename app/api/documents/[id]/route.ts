import { NextResponse, type NextRequest } from "next/server";

import { requireSession, canWrite } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { updateDocumentSchema } from "@/lib/validations/document";

interface Params {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    if (!canWrite(session.role)) {
      return NextResponse.json(
        { error: "You do not have permission to edit documents" },
        { status: 403 }
      );
    }

    const existing = await prisma.document.findFirst({
      where: { id: params.id, orgId: session.orgId },
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
      where: { id: params.id },
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

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    if (!canWrite(session.role)) {
      return NextResponse.json(
        { error: "You do not have permission to delete documents" },
        { status: 403 }
      );
    }

    const existing = await prisma.document.findFirst({
      where: { id: params.id, orgId: session.orgId },
      select: { id: true, containerId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.document.delete({ where: { id: params.id } });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "deleted_document",
      entityType: "container",
      entityId: existing.containerId,
      summary: "Document deleted",
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
