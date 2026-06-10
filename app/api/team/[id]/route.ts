import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  role: z.enum(["admin", "manager", "clearing_agent", "finance", "viewer", "auditor"]).optional(),
  isActive: z.boolean().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can manage the team" },
        { status: 403 }
      );
    }

    const target = await prisma.user.findFirst({
      where: { id, orgId: session.orgId },
      select: { id: true, email: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.id === session.userId) {
      return NextResponse.json(
        { error: "You can't change your own role" },
        { status: 400 }
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_member",
      entityType: "user",
      entityId: user.id,
      summary: `Updated ${target.email}${
        parsed.data.role ? ` → ${parsed.data.role}` : ""
      }`,
    });

    return NextResponse.json({ data: { id: user.id, role: user.role, isActive: user.isActive } });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/team/:id]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
