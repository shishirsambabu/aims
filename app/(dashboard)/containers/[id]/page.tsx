import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, FileText } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/containers/StatusBadge";
import { ContainerDetail } from "@/components/containers/ContainerDetail";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  getContainerById,
  getContainerActivity,
} from "@/lib/data/containers";
import type { ContainerStatus } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContainerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();

  let container: Awaited<ReturnType<typeof getContainerById>> = null;
  let activity: Awaited<ReturnType<typeof getContainerActivity>> = [];
  let loadError = false;

  try {
    container = await getContainerById(session.orgId, id, {
      includeFinancials: can(session.role, "financials.view"),
    });
    if (container) {
      activity = await getContainerActivity(session.orgId, id);
    }
  } catch (err) {
    console.error("[containers/:id] load failed", err);
    loadError = true;
  }

  if (loadError) {
    return (
      <div>
        <PageHeader
          title="Container"
          actions={
            <Button asChild variant="outline">
              <Link href="/containers">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
          }
        />
        <div className="m-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
          <p className="text-muted-foreground">
            The database isn&apos;t reachable from this environment. Set a
            reachable <code>DATABASE_URL</code> and apply migrations.
          </p>
        </div>
      </div>
    );
  }

  if (!container) notFound();

  // Plain-serialise (Prisma Decimal/Date → string) for the client component.
  const data = JSON.parse(JSON.stringify(container));
  const activityData = JSON.parse(JSON.stringify(activity));

  return (
    <div>
      <PageHeader
        title={container.containerNo}
        description={`BL ${container.blNo}${
          container.supplier ? ` · ${container.supplier.name}` : ""
        }`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={container.status as ContainerStatus} />
            {can(session.role, "financials.view") && (
              <Button asChild variant="outline">
                <Link href={`/print/container/${container.id}`}>
                  <FileText className="h-4 w-4" /> P&amp;L
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/containers">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
          </div>
        }
      />
      <ContainerDetail
        container={data}
        activity={activityData}
        perms={{
          container: can(session.role, "container.write"),
          cost: can(session.role, "cost.write"),
          finalize: can(session.role, "cost.finalize"),
    unlock: can(session.role, "cost.unlock"),
    sale: can(session.role, "sale.write"),
    saleApprove: can(session.role, "sale.approve"),
    docs: can(session.role, "doc.write"),
          financials: can(session.role, "financials.view"),
        }}
        orgId={session.orgId}
      />
    </div>
  );
}
