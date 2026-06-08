import Link from "next/link";
import { Plus, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ContainerFilters } from "@/components/containers/ContainerFilters";
import { ContainerTable } from "@/components/containers/ContainerTable";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listContainers, type ContainerListRow } from "@/lib/data/containers";
import type { ContainerStatus } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    q?: string;
    port?: string;
    supplierId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export default async function ContainersPage({ searchParams }: PageProps) {
  const { orgId } = await requireSession();

  let rows: ContainerListRow[] = [];
  let suppliers: { id: string; name: string }[] = [];
  let loadError = false;

  try {
    [rows, suppliers] = await Promise.all([
      listContainers(orgId, {
        q: searchParams.q,
        port: searchParams.port,
        supplierId: searchParams.supplierId,
        status: searchParams.status as ContainerStatus | undefined,
        dateFrom: searchParams.dateFrom,
        dateTo: searchParams.dateTo,
      }),
      prisma.supplier.findMany({
        where: { orgId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    console.error("[containers/page] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Containers"
        description="Every import container — Container No and BL No, costs, status and profit."
        actions={
          <Button asChild>
            <Link href="/containers/new">
              <Plus className="h-4 w-4" /> New Container
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <ContainerFilters suppliers={suppliers} />

        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load containers</p>
              <p className="text-muted-foreground">
                The database isn&apos;t reachable from this environment. Set a
                reachable <code>DATABASE_URL</code> and apply migrations — see
                PROGRESS.md blockers.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {rows.length} container{rows.length === 1 ? "" : "s"}
            </p>
            <ContainerTable data={rows} />
          </>
        )}
      </div>
    </div>
  );
}
