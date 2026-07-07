import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { STORAGE_BUCKET } from "@/lib/constants";
import { dossierArchiveName, dossierDocumentFileName } from "@/lib/document-dossier";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";

export const runtime = "nodejs";

async function fetchDocumentBytes(filePath: string): Promise<ArrayBuffer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 120);

  if (error || !data?.signedUrl) return null;

  const res = await fetch(data.signedUrl);
  if (!res.ok) return null;
  return res.arrayBuffer();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "doc.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const container = await prisma.container.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: {
        id: true,
        containerNo: true,
        blNo: true,
        documents: {
          where: { deletedAt: null },
          orderBy: [{ type: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            type: true,
            docNo: true,
            filePath: true,
            fileName: true,
            status: true,
          },
        },
      },
    });

    if (!container) {
      return NextResponse.json({ error: "Container not found" }, { status: 404 });
    }

    const docs = container.documents.filter((d) => d.filePath);
    if (docs.length === 0) {
      return NextResponse.json(
        { error: "No document files found for this container" },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    const manifest: string[] = [
      `Container: ${container.containerNo}`,
      `BL No: ${container.blNo}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      "Included documents:",
    ];
    let added = 0;

    for (const doc of docs) {
      if (!doc.filePath) continue;
      const bytes = await fetchDocumentBytes(doc.filePath);
      if (!bytes) {
        manifest.push(`- SKIPPED ${doc.type}: file could not be fetched`);
        continue;
      }

      const fileName = dossierDocumentFileName({
        index: added + 1,
        type: doc.type,
        docNo: doc.docNo,
        status: doc.status,
        fileName: doc.fileName,
      });

      zip.file(fileName, bytes);
      manifest.push(`- ${fileName}`);
      added += 1;
    }

    if (added === 0) {
      return NextResponse.json(
        { error: "No document files could be added to the dossier" },
        { status: 502 }
      );
    }

    zip.file("MANIFEST.txt", manifest.join("\n"));
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "downloaded_document_dossier",
      entityType: "container",
      entityId: container.id,
      summary: `Downloaded document dossier for ${container.containerNo} (${added} files)`,
    });

    const archiveName = dossierArchiveName(container.containerNo, container.blNo);

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archiveName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/containers/:id/documents/zip]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
