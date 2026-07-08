import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { invalidateFeatureFlags } from "@/lib/feature-flags";

const patchSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_.-]+$/, "Flag keys are lowercase snake/kebab case"),
  enabled: z.boolean(),
  description: z.string().max(300).optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "team.manage")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const flags = await prisma.featureFlag.findMany({
      where: { orgId: session.orgId },
      orderBy: { key: "asc" },
      select: { key: true, enabled: true, description: true, updatedAt: true },
    });
    return NextResponse.json({ data: flags });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "team.manage")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const { key, enabled, description } = parsed.data;

    const flag = await prisma.featureFlag.upsert({
      where: { orgId_key: { orgId: session.orgId, key } },
      create: {
        orgId: session.orgId,
        key,
        enabled,
        description,
        updatedById: session.userId,
      },
      update: { enabled, description, updatedById: session.userId },
    });

    invalidateFeatureFlags(session.orgId);
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      entityType: "feature_flag",
      entityId: flag.id,
      action: enabled ? "flag_enabled" : "flag_disabled",
      metadata: { key },
    });

    return NextResponse.json({ data: { key: flag.key, enabled: flag.enabled } });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/feature-flags]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
