import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getContainerById } from "@/lib/data/containers";
import { updateContainerSchema } from "@/lib/validations/container";
import { canTransition } from "@/lib/workflow";
import { PORTS } from "@/lib/constants";
import type { ContainerStatus, DocumentType } from "@/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const container = await getContainerById(session.orgId, id, {
      includeFinancials: can(session.role, "financials.view"),
    });
    if (!container) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: container });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "container.write")) {
      return NextResponse.json(
        { error: "You do not have permission to edit containers" },
        { status: 403 }
      );
    }

    const existing = await prisma.container.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: {
        id: true, status: true, containerNo: true,
        eta: true, ata: true, originalEta: true, freeDays: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateContainerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // Enforce the workflow state machine on status changes.
    if (input.status && input.status !== existing.status) {
      const [docs, sale] = await Promise.all([
        prisma.document.findMany({
          where: { containerId: existing.id, status: "Verified", deletedAt: null },
          select: { type: true },
        }),
        prisma.sale.findUnique({
          where: { containerId: existing.id },
          select: { saleValue: true },
        }),
      ]);
      const check = canTransition(
        existing.status as ContainerStatus,
        input.status as ContainerStatus,
        {
          verifiedDocTypes: docs.map(
            (d: { type: DocumentType }) => d.type
          ),
          hasSales: sale?.saleValue != null,
        }
      );
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 409 });
      }
    }

    const portCode =
      input.portCode ??
      (input.port ? PORTS.find((p) => p.name === input.port)?.code : undefined);

    // ETA revision: remember the original ETA the first time ETA changes.
    let originalEta: Date | undefined = undefined;
    if (
      input.eta &&
      existing.eta &&
      input.eta.getTime() !== existing.eta.getTime() &&
      !existing.originalEta
    ) {
      originalEta = existing.eta;
    }

    // Free time: prefer ATA (actual) over ETA as the base; recompute when not
    // explicitly provided.
    let lastFreeDate = input.lastFreeDate;
    if (lastFreeDate === undefined) {
      const base = input.ata ?? existing.ata ?? input.eta ?? existing.eta ?? null;
      const days = input.freeDays ?? existing.freeDays ?? null;
      if (base && days) {
        const d = new Date(base);
        d.setDate(d.getDate() + days);
        lastFreeDate = d;
      }
    }

    const justArrived = !!input.ata && !existing.ata;

    const container = await prisma.container.update({
      where: { id },
      data: {
        containerNo: input.containerNo,
        blNo: input.blNo,
        supplierId: input.supplierId,
        customer: input.customer,
        port: input.port,
        portCode,
        pol: input.pol,
        origin: input.origin,
        line: input.line,
        vessel: input.vessel,
        transhipment: input.transhipment,
        item: input.item,
        variety: input.variety,
        packageType: input.packageType,
        perPackageWeight: input.perPackageWeight,
        noOfBoxes: input.noOfBoxes,
        transitTime: input.transitTime,
        status: input.status,
        etd: input.etd,
        eta: input.eta,
        ata: input.ata,
        originalEta,
        bookingDate: input.bookingDate,
        doUpto: input.doUpto,
        emptyReturnDate: input.emptyReturnDate,
        freeDays: input.freeDays,
        lastFreeDate,
        remarks: input.remarks,
      },
    });

    const statusChanged = input.status && input.status !== existing.status;
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: justArrived
        ? "marked_arrived"
        : statusChanged
          ? "status_changed"
          : "updated",
      entityType: "container",
      entityId: container.id,
      summary: justArrived
        ? `${container.containerNo} marked arrived (ATA set)`
        : statusChanged
          ? `Status of ${container.containerNo} → ${input.status}`
          : `Updated container ${container.containerNo}`,
    });

    return NextResponse.json({ data: container });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (isUniqueError(err)) {
    return NextResponse.json(
      { error: "A container with this Container No already exists" },
      { status: 409 }
    );
  }
  console.error("[api/containers/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

function isUniqueError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
