import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

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
    const { orgId } = await requireSession();
    const sp = request.nextUrl.searchParams;

    const rows = await listContainers(orgId, {
      q: sp.get("q") ?? undefined,
      port: sp.get("port") ?? undefined,
      supplierId: sp.get("supplierId") ?? undefined,
      status: (sp.get("status") as ContainerStatus) ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    });

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
    const portCode =
      input.portCode ??
      PORTS.find((p) => p.name === input.port)?.code ??
      undefined;

    const container = await prisma.container.create({
      data: {
        orgId: session.orgId,
        slNo: await nextSlNo(session.orgId),
        containerNo: input.containerNo,
        blNo: input.blNo,
        supplierId: input.supplierId,
        customer: input.customer,
        port: input.port,
        portCode,
        item: input.item,
        variety: input.variety,
        noOfBoxes: input.noOfBoxes,
        status: input.status,
        etd: input.etd,
        eta: input.eta,
        bookingDate: input.bookingDate,
        remarks: input.remarks,
      },
    });

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
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
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
