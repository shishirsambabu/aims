import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { validateDocumentUploadMetadata } from "@/lib/upload-security";

const createJobSchema = z.object({
  source: z.enum(["Email", "OCR", "Manual", "Import"]),
  containerId: z.string().optional(),
  documentId: z.string().optional(),
  fileName: z.string().optional(),
  filePath: z.string().optional(),
  fileSize: z.coerce.number().int().optional(),
  sender: z.string().optional(),
  subject: z.string().optional(),
  matchSummary: z.string().optional(),
  extractedData: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "doc.verify") && session.role !== "admin") {
      return NextResponse.json(
        { error: "You do not have permission to view document automation jobs" },
        { status: 403 }
      );
    }

    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const rows = await prisma.documentAutomationJob.findMany({
      where: { orgId: session.orgId, status },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "doc.write")) {
      return NextResponse.json(
        { error: "You do not have permission to queue document automation jobs" },
        { status: 403 }
      );
    }

    const parsed = createJobSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    if (input.filePath || input.fileName || input.fileSize != null) {
      if (!input.containerId) {
        return NextResponse.json(
          { error: "Container is required when queueing a file automation job" },
          { status: 422 }
        );
      }
      const container = await prisma.container.findFirst({
        where: { id: input.containerId, orgId: session.orgId, deletedAt: null },
        select: { id: true },
      });
      if (!container) {
        return NextResponse.json({ error: "Container not found" }, { status: 404 });
      }
      const uploadError = validateDocumentUploadMetadata({
        orgId: session.orgId,
        containerId: input.containerId,
        type: "Other",
        filePath: input.filePath,
        fileName: input.fileName,
        fileSize: input.fileSize,
      });
      if (uploadError) {
        return NextResponse.json({ error: uploadError }, { status: 422 });
      }
    }

    const job = await prisma.documentAutomationJob.create({
      data: {
        orgId: session.orgId,
        source: input.source,
        containerId: input.containerId,
        documentId: input.documentId,
        fileName: input.fileName,
        filePath: input.filePath,
        sender: input.sender,
        subject: input.subject,
        matchSummary: input.matchSummary,
        extractedData: input.extractedData as Prisma.InputJsonValue | undefined,
        confidence: input.confidence,
      },
    });

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/document-automation/jobs]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
