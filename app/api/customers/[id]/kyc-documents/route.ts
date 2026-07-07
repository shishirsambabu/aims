import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  customerKycDocumentSchema,
  customerKycReviewSchema,
} from "@/lib/validations/customer";
import { Prisma } from "@prisma/client";

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

    const parsed = customerKycDocumentSchema.safeParse(await request.json());
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
    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.customerKycDocument.create({
        data: {
          orgId: session.orgId,
          customerId: customer.id,
          ...input,
        },
      });
      await syncCustomerKycStatus(tx, session.orgId, customer.id);
      return created;
    });

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "customer_kyc_document_created",
      entityType: "customer",
      entityId: customer.id,
      summary: `Added KYC document for ${customer.name}`,
      metadata: { doc },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "crm.kyc.approve")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = customerKycReviewSchema.safeParse(await request.json());
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

  const body = parsed.data;

    const reviewed = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerKycDocument.findFirst({
        where: { id: body.docId, orgId: session.orgId, customerId: customer.id },
      });
      if (!existing) {
        return null;
      }

      const updated = await tx.customerKycDocument.update({
        where: { id: body.docId },
        data: {
          status: body.action === "approve" ? "Approved" : "Rejected",
          reviewedById: session.userId,
          reviewedAt: new Date(),
          notes: body.reason ?? existing.notes,
        },
      });
      await syncCustomerKycStatus(tx, session.orgId, customer.id);
      return updated;
    });
    if (!reviewed) {
      return NextResponse.json({ error: "KYC document not found" }, { status: 404 });
    }

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action:
        body.action === "approve"
          ? "approved_customer_kyc"
          : "rejected_customer_kyc",
      entityType: "customer",
      entityId: customer.id,
      summary: `${body.action === "approve" ? "Approved" : "Rejected"} KYC document for ${customer.name}`,
      metadata: { docId: body.docId, reason: body.reason ?? null },
    });

  return NextResponse.json({ data: reviewed });
  } catch (err) {
    return handleError(err);
  }
}

async function syncCustomerKycStatus(
  tx: Prisma.TransactionClient,
  orgId: string,
  customerId: string
) {
  const docs = await tx.customerKycDocument.findMany({
    where: { orgId, customerId },
    select: { status: true },
  });

  const nextStatus =
    docs.length === 0
      ? "Pending"
      : docs.some((doc) => doc.status === "Rejected")
        ? "Rejected"
        : docs.every((doc) => doc.status === "Approved")
          ? "Approved"
          : "Pending";

  await tx.customer.update({
    where: { id: customerId },
    data: { kycStatus: nextStatus },
  });
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/customers/:id/kyc-documents]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
