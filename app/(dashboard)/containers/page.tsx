import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContainerFilters } from "@/components/containers/ContainerFilters";
import { ContainerTable } from "@/components/containers/ContainerTable";
import { ExportButton } from "@/components/containers/ExportButton";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listContainers, type ContainerListRow } from "@/lib/data/containers";
import { cn, formatINR } from "@/lib/utils";
import type { ContainerStatus } from "@/types";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    port?: string;
    supplierId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function ContainersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await requireSession();
  requirePageAccess(session.role, ["container.view"]);
  const orgId = session.orgId;
  const showFinancials = can(session.role, "financials.view");
  const canEditContainers = can(session.role, "container.write");

  let rows: ContainerListRow[] = [];
  let suppliers: { id: string; name: string }[] = [];
  let loadError = false;

  try {
    [rows, suppliers] = await Promise.all([
      listContainers(
        orgId,
        {
          q: params.q,
          port: params.port,
          supplierId: params.supplierId,
          status: params.status as ContainerStatus | undefined,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        },
        { includeFinancials: showFinancials }
      ),
      prisma.supplier.findMany({
        where: { orgId, deletedAt: null, approvalStatus: "Approved" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
  } catch (err) {
    console.error("[containers/page] load failed", err);
    loadError = true;
  }

  const totalContainers = rows.length;
  const flaggedCount = rows.filter((row) => row.flagged).length;
  const avgDocScore =
    totalContainers > 0
      ? rows.reduce((sum, row) => sum + row.docScore, 0) / totalContainers
      : 0;
  const netProfit = rows.reduce((sum, row) => sum + (row.profit ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Containers"
        description="Every import container keeps Container No, BL No, costs, status, and profit in one place."
        actions={
          <div className="flex items-center gap-2">
            {showFinancials && <ExportButton rows={rows} />}
            <Button asChild>
              <Link href="/containers/new">
                <Plus className="h-4 w-4" /> New Container
              </Link>
            </Button>
          </div>
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
                reachable <code>DATABASE_URL</code> and apply migrations. See
                PROGRESS.md blockers.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Containers"
                value={totalContainers.toString()}
                hint="Matched rows"
              />
              <SummaryCard
                label="Flagged"
                value={flaggedCount.toString()}
                hint="Needs attention"
                tone={flaggedCount > 0 ? "text-warning" : "text-success"}
              />
              <SummaryCard
                label="Doc Score Avg"
                value={totalContainers > 0 ? `${avgDocScore.toFixed(1)}/9` : "0/9"}
                hint="Document completeness"
              />
              {showFinancials ? (
                <SummaryCard
                  label="Net Profit"
                  value={formatINR(netProfit)}
                  hint="Visible to finance roles"
                  tone={netProfit >= 0 ? "text-success" : "text-danger"}
                />
              ) : (
                <SummaryCard
                  label="Financial View"
                  value="Restricted"
                  hint="Hidden for this role"
                />
              )}
            </div>

            <ContainerTable
              data={rows}
              showFinancials={showFinancials}
              canEdit={canEditContainers}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("font-financial mt-1 text-2xl font-bold", tone)}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
