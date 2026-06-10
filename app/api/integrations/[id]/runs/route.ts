import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const runSchema = z.object({
  mode: z.enum(["TestConnection", "DryRun", "Manual"]).default("DryRun"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json(
        { error: "You do not have permission to run integrations" },
        { status: 403 }
      );
    }

    const connection = await prisma.integrationConnection.findFirst({
      where: { id, orgId: session.orgId },
    });
    if (!connection) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const parsed = runSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const now = new Date();
    const run = await prisma.integrationRun.create({
      data: {
        orgId: session.orgId,
        connectionId: connection.id,
        mode: parsed.data.mode,
        status: "Blocked",
        startedAt: now,
        finishedAt: now,
        summary:
          "Provider adapter not connected yet. Add credentials and adapter implementation before live sync.",
      },
    });

    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        lastTestAt: parsed.data.mode === "TestConnection" ? now : undefined,
        errorMessage:
          "Provider adapter not connected yet. This run was recorded as a dry-run placeholder.",
      },
    });

    return NextResponse.json({ data: run }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/integrations/:id/runs]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
