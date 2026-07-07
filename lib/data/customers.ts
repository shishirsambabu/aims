import "server-only";

import { prisma } from "@/lib/prisma";
import type { ApprovalStatus, CustomerKycStatus, Role } from "@/types";

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export interface CustomerRecord {
  id: string;
  code: string;
  name: string;
  tradeName: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  deliveryInstructions: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  assignedRepId: string | null;
  assignedRepName: string | null;
  creditLimit: number | null;
  customerTier: string | null;
  paymentTermsDays: number;
  creditReviewDate: string | null;
  creditHold: boolean;
  kycStatus: CustomerKycStatus;
  approvalStatus: ApprovalStatus;
  contactCount: number;
  primaryContact: string | null;
  kycDocumentCount: number;
  notes: string | null;
}

export async function listCustomers(orgId: string, assignedRepId?: string): Promise<CustomerRecord[]> {
  const rows = await prisma.customer.findMany({
    where: { orgId, deletedAt: null, ...(assignedRepId ? { assignedRepId } : {}) },
    orderBy: [{ name: "asc" }],
    include: {
      assignedRep: { select: { fullName: true, email: true } },
      _count: { select: { contacts: true, kycDocuments: true } },
      contacts: {
        where: { isPrimary: true },
        take: 1,
        select: { name: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    tradeName: row.tradeName,
    gstin: row.gstin,
    pan: row.pan,
    email: row.email,
    phone: row.phone,
    billingAddress: row.billingAddress,
    shippingAddress: row.shippingAddress,
    deliveryInstructions: row.deliveryInstructions,
    city: row.city,
    state: row.state,
    region: row.region,
    assignedRepId: row.assignedRepId,
    assignedRepName: row.assignedRep?.fullName ?? row.assignedRep?.email ?? null,
    creditLimit: dec(row.creditLimit),
    customerTier: row.customerTier,
    paymentTermsDays: row.paymentTermsDays,
    creditReviewDate: iso(row.creditReviewDate),
    creditHold: row.creditHold,
    kycStatus: row.kycStatus,
    approvalStatus: row.approvalStatus,
    contactCount: row._count.contacts,
    primaryContact: row.contacts[0]?.name ?? null,
    kycDocumentCount: row._count.kycDocuments,
    notes: row.notes,
  }));
}

export async function getCustomerById(orgId: string, id: string, assignedRepId?: string) {
  const [customer, activityLogs] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, orgId, deletedAt: null, ...(assignedRepId ? { assignedRepId } : {}) },
      include: {
        assignedRep: { select: { id: true, fullName: true, email: true } },
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        kycDocuments: {
          orderBy: { createdAt: "desc" },
          include: { reviewedBy: { select: { fullName: true, email: true } } },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: { orgId, entityType: "customer", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { fullName: true, email: true } } },
    }),
  ]);

  if (!customer) return null;

  const creditHoldTrail = activityLogs
    .map((log) => {
      const metadata = (log.metadata as Record<string, unknown> | null | undefined) ?? {};
      const before = metadata.before as Record<string, unknown> | undefined;
      const after = metadata.after as Record<string, unknown> | undefined;
      const pending = metadata.pending as Record<string, unknown> | undefined;
      const pendingData = pending?.data as Record<string, unknown> | undefined;
      const beforeHold = boolOrNull(before?.creditHold);
      const afterHold =
        boolOrNull(after?.creditHold) ??
        boolOrNull(pending?.creditHold) ??
        boolOrNull(pendingData?.creditHold);
      if (beforeHold == null && afterHold == null) return null;
      if (beforeHold === afterHold) return null;
      return {
        id: log.id,
        action: log.action,
        createdAt: iso(log.createdAt),
        user: log.user?.fullName ?? log.user?.email ?? null,
        from: beforeHold,
        to: afterHold,
        reason:
          (typeof metadata.reason === "string" && metadata.reason.trim()) ||
          (typeof metadata.reviewNotes === "string" && metadata.reviewNotes.trim()) ||
          log.summary ||
          null,
      };
    })
    .filter(
      (entry): entry is {
        id: string;
        action: string;
        createdAt: string | null;
        user: string | null;
        from: boolean | null;
        to: boolean | null;
        reason: string | null;
      } => entry != null
    );

  const activityTimeline = activityLogs.map((log) => ({
    id: log.id,
    action: log.action,
    summary: log.summary ?? null,
    createdAt: iso(log.createdAt),
    user: log.user?.fullName ?? log.user?.email ?? null,
  }));

  return {
    ...customer,
    activityTimeline,
    creditHoldTrail,
  };
}

export async function getSalesRepOptions(orgId: string) {
  return prisma.user.findMany({
    where: {
      orgId,
      isActive: true,
      role: { in: ["sales_executive", "manager", "gm", "admin"] as Role[] },
    },
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
    select: { id: true, fullName: true, email: true, role: true },
  });
}
