import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { listDocuments } from "@/lib/data/documents";
import { createDocumentSchema } from "@/lib/validations/document";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { validateDocumentUploadMetadata } from "@/lib/upload-security";
import type { DocumentStatus, DocumentType } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "doc.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const sp = request.nextUrl.searchParams;
    const rows = await listDocuments(session.orgId, {
      q: sp.get("q") ?? undefined,
      type: (sp.get("type") as DocumentType) ?? undefined,
      status: (sp.get("status") as DocumentStatus) ?? undefined,
      containerId: sp.get("containerId") ?? undefined,
      expiringSoon: sp.get("expiringSoon") === "1",
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleError(err, "list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "doc.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    if (!can(session.role, "doc.write")) {
      return NextResponse.json(
        { error: "You do not have permission to add documents" },
        { status: 403 }
      );
    }

    const parsed = createDocumentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const input = parsed.data;

    // Denormalise container identity for fast filtering, with org check.
    const container = await prisma.container.findFirst({
      where: { id: input.containerId, orgId: session.orgId, deletedAt: null },
      select: {
        id: true,
        containerNo: true,
        blNo: true,
        supplier: { select: { name: true } },
      },
    });
    if (!container) {
      return NextResponse.json(
        { error: "Container not found" },
        { status: 404 }
      );
    }

    const uploadError = validateDocumentUploadMetadata({
      orgId: session.orgId,
      containerId: container.id,
      type: input.type,
      filePath: input.filePath,
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileUrl: input.fileUrl,
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 422 });
    }

    const doc = await prisma.document.create({
      data: {
        orgId: session.orgId,
        containerId: container.id,
        type: input.type,
        docNo: input.docNo,
        containerNo: container.containerNo,
        blNo: container.blNo,
        supplierName: container.supplier?.name ?? null,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        status: input.status,
        filePath: input.filePath,
        fileUrl: null,
        fileName: input.fileName,
        fileSize: input.fileSize,
      },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "uploaded_document",
      entityType: "container",
      entityId: container.id,
      summary: `${DOCUMENT_TYPE_LABELS[input.type]} added to ${container.containerNo}`,
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (err) {
    return handleError(err, "create");
  }
}

function handleError(err: unknown, op: string) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error(`[api/documents:${op}]`, err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
