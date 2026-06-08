import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireSession, canWrite } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getContainerById } from "@/lib/data/containers";
import { updateContainerSchema } from "@/lib/validations/container";
import { PORTS } from "@/lib/constants";

interface Params {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { orgId } = await requireSession();
    const container = await getContainerById(orgId, params.id);
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
    const session = await requireSession();
    if (!canWrite(session.role)) {
      return NextResponse.json(
        { error: "You do not have permission to edit containers" },
        { status: 403 }
      );
    }

    const existing = await prisma.container.findFirst({
      where: { id: params.id, orgId: session.orgId },
      select: { id: true, status: true, containerNo: true },
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
    const portCode =
      input.portCode ??
      (input.port ? PORTS.find((p) => p.name === input.port)?.code : undefined);

    const container = await prisma.container.update({
      where: { id: params.id },
      data: {
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

    const statusChanged = input.status && input.status !== existing.status;
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: statusChanged ? "status_changed" : "updated",
      entityType: "container",
      entityId: container.id,
      summary: statusChanged
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
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return NextResponse.json(
      { error: "A container with this Container No already exists" },
      { status: 409 }
    );
  }
  console.error("[api/containers/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
