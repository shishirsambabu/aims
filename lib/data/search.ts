import "server-only";

import { prisma } from "@/lib/prisma";
import type { ContainerStatus, DocumentType } from "@/types";

export interface SearchResults {
  containers: {
    id: string;
    containerNo: string;
    blNo: string;
    supplier: string | null;
    status: ContainerStatus;
  }[];
  documents: {
    id: string;
    containerId: string;
    type: DocumentType;
    docNo: string | null;
    containerNo: string | null;
  }[];
  payments: {
    id: string;
    containerNo: string | null;
    reference: string | null;
    amount: number;
    currency: string;
  }[];
}

export async function searchAll(
  orgId: string,
  q: string
): Promise<SearchResults> {
  const term = q.trim();
  if (!term) return { containers: [], documents: [], payments: [] };
  const like = { contains: term, mode: "insensitive" as const };

  const [containers, documents, payments] = await Promise.all([
    prisma.container.findMany({
      where: {
        orgId,
        deletedAt: null,
        OR: [{ containerNo: like }, { blNo: like }, { item: like }],
      },
      take: 25,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        containerNo: true,
        blNo: true,
        status: true,
        supplier: { select: { name: true } },
      },
    }),
    prisma.document.findMany({
      where: {
        orgId,
        deletedAt: null,
        OR: [{ docNo: like }, { containerNo: like }, { blNo: like }],
      },
      take: 25,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        containerId: true,
        type: true,
        docNo: true,
        containerNo: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        orgId,
        deletedAt: null,
        OR: [{ reference: like }, { container: { containerNo: like } }],
      },
      take: 25,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        amountRequested: true,
        currency: true,
        container: { select: { containerNo: true } },
      },
    }),
  ]);

  return {
    containers: containers.map((c: {
      id: string;
      containerNo: string;
      blNo: string;
      status: ContainerStatus;
      supplier: { name: string } | null;
    }) => ({
      id: c.id,
      containerNo: c.containerNo,
      blNo: c.blNo,
      supplier: c.supplier?.name ?? null,
      status: c.status as ContainerStatus,
    })),
    documents: documents.map((d: {
      id: string;
      containerId: string;
      type: DocumentType;
      docNo: string | null;
      containerNo: string | null;
    }) => ({
      id: d.id,
      containerId: d.containerId,
      type: d.type as DocumentType,
      docNo: d.docNo,
      containerNo: d.containerNo,
    })),
    payments: payments.map((p: {
      id: string;
      reference: string | null;
      amountRequested: unknown;
      currency: string;
      container: { containerNo: string } | null;
    }) => ({
      id: p.id,
      containerNo: p.container?.containerNo ?? null,
      reference: p.reference,
      amount: Number(p.amountRequested),
      currency: p.currency,
    })),
  };
}
