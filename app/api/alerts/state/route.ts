import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const categorySchema = z.enum([
  "arrival",
  "demurrage",
  "docExpiry",
  "approval",
  "paymentOverdue",
  "lossMaking",
  "flagged",
]);

const stateSchema = z.object({
  alertKey: z.string().min(1),
  category: categorySchema,
  action: z.enum(["read", "snooze", "resolve", "reopen"]),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const parsed = stateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { alertKey, category, action } = parsed.data;
    const now = new Date();
    const snoozedUntil = new Date(now);
    snoozedUntil.setDate(snoozedUntil.getDate() + 1);

    const data =
      action === "read"
        ? { readAt: now }
        : action === "snooze"
          ? { readAt: now, snoozedUntil, resolvedAt: null }
          : action === "resolve"
            ? { readAt: now, resolvedAt: now, snoozedUntil: null }
            : { resolvedAt: null, snoozedUntil: null };

    await prisma.userAlertState.upsert({
      where: { userId_alertKey: { userId: session.userId, alertKey } },
      create: {
        orgId: session.orgId,
        userId: session.userId,
        alertKey,
        category,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/alerts/state]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
