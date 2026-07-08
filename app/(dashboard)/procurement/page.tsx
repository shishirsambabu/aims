import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  PurchaseOrderWorkspace,
  type PoRow,
} from "@/components/procurement/PurchaseOrderWorkspace";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

function num(value: unknown): number {
  return value == null ? 0 : Number(value);
}

export default async function ProcurementPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["payment.view", "financials.view"]);
  const canWrite =
    can(session.role, "payment.write") || can(session.role, "masterdata.write");

  let orders: PoRow[] = [];
  let suppliers: { id: string; name: string }[] = [];
  let containers: { id: string; containerNo: string }[] = [];
  let loadError = false;

  try {
    const [poRows, supplierRows, containerRows] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { orgId: session.orgId },
        orderBy: [{ poDate: "desc" }, { createdAt: "desc" }],
        take: 100,
        include: {
          supplier: { select: { name: true } },
          container: { select: { containerNo: true } },
          _count: { select: { lines: true } },
        },
      }),
      prisma.supplier.findMany({
        where: { orgId: session.orgId, deletedAt: null, approvalStatus: "Approved" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.container.findMany({
        where: { orgId: session.orgId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, containerNo: true },
      }),
    ]);

    orders = poRows.map((row: (typeof poRows)[number]) => {
      const estimatedTotal =
        num(row.estimatedGoodsValue) +
        num(row.estimatedFreight) +
        num(row.estimatedDuties) +
        num(row.estimatedLocalCosts);
      return {
        id: row.id,
        poNo: row.poNo,
        poDate: row.poDate.toISOString(),
        status: row.status,
        currency: row.currency as PoRow["currency"],
        supplierName: row.supplier.name,
        containerNo: row.container?.containerNo ?? null,
        estimatedGoodsValue: num(row.estimatedGoodsValue),
        estimatedTotal,
        actualLandedCost:
          row.actualLandedCost == null ? null : Number(row.actualLandedCost),
        varianceAmount:
          row.varianceAmount == null ? null : Number(row.varianceAmount),
        advancePaidAmount:
          row.advancePaidAmount == null ? null : Number(row.advancePaidAmount),
        lineCount: row._count.lines,
      };
    });
    suppliers = supplierRows;
    containers = containerRows;
  } catch (err) {
    console.error("[procurement/page] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Procurement"
        description="Purchase orders with estimated vs actual landed cost — the profit-leak detector for every buy."
      />

      <div className="p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load purchase orders</p>
              <p className="text-muted-foreground">
                The database isn&apos;t reachable from this environment. Retry once
                the connection is restored.
              </p>
            </div>
          </div>
        ) : (
          <PurchaseOrderWorkspace
            orders={orders}
            suppliers={suppliers}
            containers={containers}
            canWrite={canWrite}
          />
        )}
      </div>
    </div>
  );
}
