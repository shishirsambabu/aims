import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const connectionSchema = z.object({
  provider: z.enum(["outlook", "tally", "icegate", "carrier", "ocr", "email"]),
  name: z.string().min(2),
  status: z.enum(["NotConnected", "NeedsKeys", "Connected", "Paused"]).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json(
        { error: "You do not have permission to view integrations" },
        { status: 403 }
      );
    }

    const rows = await prisma.integrationConnection.findMany({
      where: { orgId: session.orgId },
      orderBy: { provider: "asc" },
      include: {
        runs: { orderBy: { createdAt: "desc" }, take: 3 },
        errors: { where: { resolvedAt: null }, take: 5 },
      },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!can(session.role, "masterdata.write") && session.role !== "admin") {
      return NextResponse.json(
        { error: "You do not have permission to configure integrations" },
        { status: 403 }
      );
    }

    const parsed = connectionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const config = input.config as Prisma.InputJsonValue | undefined;
    const row = await prisma.integrationConnection.upsert({
      where: {
        orgId_provider: { orgId: session.orgId, provider: input.provider },
      },
      create: {
        orgId: session.orgId,
        provider: input.provider,
        name: input.name,
        status: input.status ?? "NeedsKeys",
        config,
      },
      update: {
        name: input.name,
        status: input.status ?? "NeedsKeys",
        config,
      },
    });

    return NextResponse.json({ data: row });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/integrations]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
