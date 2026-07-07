import { prisma } from "@/lib/prisma";

function normalize(value: string | undefined | null) {
  return value?.trim().toUpperCase() ?? "";
}

export async function findCustomerDuplicate(orgId: string, input: { id?: string; code: string; gstin: string; pan: string }) {
  const code = normalize(input.code);
  const gstin = normalize(input.gstin);
  const pan = normalize(input.pan);

  if (!code || !gstin || !pan) {
    return null;
  }

  return prisma.customer.findFirst({
    where: {
      orgId,
      deletedAt: null,
      id: input.id ? { not: input.id } : undefined,
      OR: [{ code }, { gstin }, { pan }],
    },
    select: {
      id: true,
      code: true,
      name: true,
      gstin: true,
      pan: true,
    },
  });
}

export async function getCustomerCreditExposure(orgId: string, customerId: string) {
  const orders = await prisma.salesOrder.findMany({
    where: {
      orgId,
      customerId,
      status: { notIn: ["Draft", "Rejected", "Cancelled"] },
    },
    select: {
      netAmount: true,
      receiptAllocations: {
        where: { receipt: { status: "Posted" } },
        select: { amount: true },
      },
    },
  });

  return orders.reduce((total, order) => {
    const received = order.receiptAllocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount),
      0
    );
    return total + Math.max(Number(order.netAmount ?? 0) - received, 0);
  }, 0);
}
