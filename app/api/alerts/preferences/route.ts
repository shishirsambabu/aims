import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const preferenceSchema = z.object({
  category: z.enum([
    "arrival",
    "demurrage",
    "docExpiry",
    "approval",
    "paymentOverdue",
    "lossMaking",
    "flagged",
  ]),
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const parsed = preferenceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { category, enabled } = parsed.data;
    await prisma.userAlertPreference.upsert({
      where: { userId_category: { userId: session.userId, category } },
      create: {
        orgId: session.orgId,
        userId: session.userId,
        category,
        enabled,
      },
      update: { enabled },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/alerts/preferences]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
