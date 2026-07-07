import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { customerContactSchema } from "@/lib/validations/customer";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "crm.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = customerContactSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const customer = await prisma.customer.findFirst({
      where: { id, orgId: session.orgId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const input = parsed.data;
    const contact = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.customerContact.count({
        where: { orgId: session.orgId, customerId: customer.id },
      });
      const shouldBePrimary = input.isPrimary || existingCount === 0;
      if (shouldBePrimary) {
        await tx.customerContact.updateMany({
          where: { orgId: session.orgId, customerId: customer.id },
          data: { isPrimary: false },
        });
      }
      return tx.customerContact.create({
        data: {
          orgId: session.orgId,
          customerId: customer.id,
          ...input,
          isPrimary: shouldBePrimary,
        },
      });
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "customer_contact_created",
      entityType: "customer",
      entityId: customer.id,
      summary: `Added contact ${contact.name} to ${customer.name}`,
      metadata: { contact },
    });

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/customers/:id/contacts]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
