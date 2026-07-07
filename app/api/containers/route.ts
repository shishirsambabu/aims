import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { listContainers, nextSlNo } from "@/lib/data/containers";
import { createContainerSchema } from "@/lib/validations/container";
import { PORTS } from "@/lib/constants";
import type { ContainerStatus } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "container.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const sp = request.nextUrl.searchParams;

    const rows = await listContainers(session.orgId, {
      q: sp.get("q") ?? undefined,
      port: sp.get("port") ?? undefined,
      supplierId: sp.get("supplierId") ?? undefined,
      status: (sp.get("status") as ContainerStatus) ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    }, { includeFinancials: can(session.role, "financials.view") });

    return NextResponse.json({ data: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "container.write")) {
      return NextResponse.json(
        { error: "You do not have permission to create containers" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createContainerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    if (input.status !== "Booked") {
      return NextResponse.json(
        { error: "New containers must start in Booked status" },
        { status: 422 }
      );
    }
    const portCode =
      input.portCode ??
      PORTS.find((p) => p.name === input.port)?.code ??
      undefined;
    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: input.supplierId,
          orgId: session.orgId,
          deletedAt: null,
          approvalStatus: "Approved",
        },
        select: { id: true },
      });
      if (!supplier) {
        return NextResponse.json(
          { error: "Supplier must be approved before it can be used" },
          { status: 409 }
        );
      }
    }
    if (input.warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: {
          id: input.warehouseId,
          orgId: session.orgId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      if (!warehouse) {
        return NextResponse.json(
          { error: "Warehouse not found or inactive" },
          { status: 404 }
        );
      }
    }

    // Free time auto-calculated from ETA + free days when not given explicitly.
    let lastFreeDate = input.lastFreeDate;
    if (!lastFreeDate && input.eta && input.freeDays) {
      const d = new Date(input.eta);
      d.setDate(d.getDate() + input.freeDays);
      lastFreeDate = d;
    }

    const container = await prisma.container.create({
      data: {
        orgId: session.orgId,
        slNo: await nextSlNo(session.orgId),
        containerNo: input.containerNo,
        blNo: input.blNo,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
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
        bookingDate: input.bookingDate,
        doUpto: input.doUpto,
        emptyReturnDate: input.emptyReturnDate,
        freeDays: input.freeDays,
        lastFreeDate,
        remarks: input.remarks,
        warehouseAssignedAt: input.warehouseId ? new Date() : undefined,
        warehouseAssignedById: input.warehouseId ? session.userId : undefined,
      },
    });

    // Capture shipper invoice / packing list numbers as a shipment item.
    if (input.shipperInvoiceNo || input.packingListNo) {
      await prisma.shipmentItem.create({
        data: {
          orgId: session.orgId,
          containerId: container.id,
          invoiceNo: input.shipperInvoiceNo,
          packingListNo: input.packingListNo,
        },
      });
    }

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "created",
      entityType: "container",
      entityId: container.id,
      summary: `Created container ${container.containerNo} (BL ${container.blNo})`,
    });

    return NextResponse.json({ data: container }, { status: 201 });
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
  console.error("[api/containers]", err);
  return NextResponse.json(
    { error: "Something went wrong" },
    { status: 500 }
  );
}

function isUniqueError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
