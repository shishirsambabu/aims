import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { rateLimitAsync } from "@/lib/ratelimit";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { canTransition } from "@/lib/workflow";
import { CONTAINER_STATUSES } from "@/lib/constants";
import type { ContainerStatus, DocumentType } from "@/types";

interface BulkBody {
  ids?: string[];
  action?: "status" | "flag" | "unflag" | "archive";
  status?: ContainerStatus;
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const rl = await rateLimitAsync(`bulk:${session.userId}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many requests — retry in ${rl.retryAfter}s` }, { status: 429 });
    }
    if (!can(session.role, "container.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const body = (await request.json()) as BulkBody;
    const ids = (body.ids ?? []).filter(Boolean);
    if (ids.length === 0 || !body.action) {
      return NextResponse.json({ error: "Nothing selected" }, { status: 422 });
    }

    // Scope to this org and not-deleted.
    const owned: { id: string; status: ContainerStatus; warehouseId: string | null }[] =
      await prisma.container.findMany({
      where: { id: { in: ids }, orgId: session.orgId, deletedAt: null },
      select: { id: true, status: true, warehouseId: true },
    });
    const ownedIds = owned.map((c: { id: string }) => c.id);

    let updated = 0;
    let skipped = 0;

    if (body.action === "flag" || body.action === "unflag") {
      const r = await prisma.container.updateMany({
        where: { id: { in: ownedIds }, orgId: session.orgId },
        data: { flagged: body.action === "flag" },
      });
      updated = r.count;
    } else if (body.action === "archive") {
      const r = await prisma.container.updateMany({
        where: { id: { in: ownedIds }, orgId: session.orgId },
        data: { deletedAt: new Date() },
      });
      updated = r.count;
    } else if (body.action === "status") {
      const to = body.status;
      if (!to || !CONTAINER_STATUSES.includes(to)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 422 });
      }
      // Apply per-container respecting the workflow gates.
      for (const c of owned) {
        if (c.status === to) {
          skipped += 1;
          continue;
        }
        const [docs, sale] = await Promise.all([
          prisma.document.findMany({
            where: { containerId: c.id, status: "Verified", deletedAt: null },
            select: { type: true },
          }),
          prisma.sale.findUnique({
            where: { containerId: c.id },
            select: { saleValue: true },
          }),
        ]);
        const check = canTransition(c.status as ContainerStatus, to, {
          verifiedDocTypes: docs.map(
            (d: { type: DocumentType }) => d.type
          ),
          hasSales: sale?.saleValue != null,
          hasWarehouse: !!c.warehouseId,
        });
        if (!check.ok) {
          skipped += 1;
          continue;
        }
        await prisma.container.update({
          where: { id: c.id },
          data: { status: to },
        });
        updated += 1;
      }
    }

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: `bulk_${body.action}`,
      entityType: "container",
      summary: `Bulk ${body.action} on ${updated} container(s)${
        skipped ? `, ${skipped} skipped` : ""
      }`,
    });

    return NextResponse.json({ data: { updated, skipped } });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/containers/bulk]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
