import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { STORAGE_BUCKET } from "@/lib/constants";
import { can } from "@/lib/permissions";

/**
 * Issues a short-lived signed URL for a document file and redirects to it.
 * Keeps the storage bucket private — files are never served via public URLs.
 */
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
    const doc = await prisma.document.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true, filePath: true, fileUrl: true, containerId: true, type: true },
    });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Audit the access to a (potentially sensitive) document.
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "viewed_document",
      entityType: "container",
      entityId: doc.containerId,
      summary: `Opened ${doc.type} document`,
    });

    if (doc.filePath) {
      const supabase = await createClient();
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(doc.filePath, 120);
      if (!error && data?.signedUrl) {
        return NextResponse.redirect(data.signedUrl);
      }
    }
    return NextResponse.json({ error: "No file" }, { status: 404 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/documents/:id/file]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
