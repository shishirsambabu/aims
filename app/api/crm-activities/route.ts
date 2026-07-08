import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/observability";

const activitySchema = z
  .object({
    customerId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    opportunityId: z.string().uuid().optional(),
    kind: z.string().min(2).max(40),
    direction: z.string().min(2).max(30).optional(),
    subject: z.string().min(2).max(180),
    body: z.string().max(2000).optional(),
    occurredAt: z.coerce.date().optional(),
    nextActionAt: z.coerce.date().optional(),
    externalRef: z.string().max(180).optional(),
  })
  .refine((value) => value.customerId || value.leadId || value.opportunityId, {
    message: "Activity must be linked to a customer, lead, or opportunity",
  });

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "crm.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId") ?? undefined;
    const leadId = url.searchParams.get("leadId") ?? undefined;
    const opportunityId = url.searchParams.get("opportunityId") ?? undefined;

    const activities = await prisma.crmActivity.findMany({
      where: {
        orgId: session.orgId,
        ...(customerId ? { customerId } : {}),
        ...(leadId ? { leadId } : {}),
        ...(opportunityId ? { opportunityId } : {}),
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        customer: { select: { id: true, name: true, customerTier: true } },
        lead: { select: { id: true, name: true, status: true } },
        opportunity: { select: { id: true, opportunityNo: true, stage: true, amount: true } },
      },
    });

    return NextResponse.json({ data: activities });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "crm-activities", method: "GET" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "crm.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = activitySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const activity = await prisma.crmActivity.create({
      data: {
        orgId: session.orgId,
        customerId: input.customerId ?? null,
        leadId: input.leadId ?? null,
        opportunityId: input.opportunityId ?? null,
        ownerId: session.userId,
        kind: input.kind,
        direction: input.direction ?? "Outbound",
        subject: input.subject,
        body: input.body ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        nextActionAt: input.nextActionAt ?? null,
        externalRef: input.externalRef ?? null,
      },
    });

    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "crm-activities", method: "POST" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
