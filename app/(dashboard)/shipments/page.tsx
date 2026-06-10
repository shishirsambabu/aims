import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ShipmentFilters } from "@/components/shipments/ShipmentFilters";
import { KanbanBoard } from "@/components/shipments/KanbanBoard";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listContainers, type ContainerListRow } from "@/lib/data/containers";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { port?: string; supplierId?: string };
}

export default async function ShipmentsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const editable = can(session.role, "container.write");

  let rows: ContainerListRow[] = [];
  let suppliers: { id: string; name: string }[] = [];
  let loadError = false;

  try {
    [rows, suppliers] = await Promise.all([
      listContainers(session.orgId, {
        port: searchParams.port,
        supplierId: searchParams.supplierId,
      }, { includeFinancials: false }),
      prisma.supplier.findMany({
        where: { orgId: session.orgId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    console.error("[shipments/page] load failed", err);
    loadError = true;
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Shipments"
        description="Drag containers across the pipeline — Booked to Fully Sold."
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <div className="flex items-center justify-between">
          <ShipmentFilters suppliers={suppliers} />
          {!loadError && (
            <p className="text-sm text-muted-foreground">
              {rows.length} container{rows.length === 1 ? "" : "s"}
              {!editable && " · view only"}
            </p>
          )}
        </div>

        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load shipments</p>
              <p className="text-muted-foreground">
                The database isn&apos;t reachable from this environment. Set a
                reachable <code>DATABASE_URL</code> and apply migrations.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <KanbanBoard
              key={`${searchParams.port ?? ""}|${searchParams.supplierId ?? ""}`}
              rows={rows}
              canEdit={editable}
            />
          </div>
        )}
      </div>
    </div>
  );
}
