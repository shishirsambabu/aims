import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ContainerForm } from "@/components/containers/ContainerForm";
import { requireSession } from "@/lib/auth";
import { requirePageAccess } from "@/lib/page-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewContainerPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["container.write"]);
  const { orgId } = session;

  let suppliers: { id: string; name: string }[] = [];
  let warehouses: { id: string; name: string; code: string; city: string }[] = [];
  try {
    [suppliers, warehouses] = await Promise.all([
      prisma.supplier.findMany({
        where: { orgId, deletedAt: null, approvalStatus: "Approved" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.warehouse.findMany({
        where: { orgId, deletedAt: null, isActive: true },
        orderBy: [{ city: "asc" }, { name: "asc" }],
        select: { id: true, name: true, code: true, city: true },
      }),
    ]);
  } catch (err) {
    console.error("[containers/new] master data load failed", err);
  }

  return (
    <div>
      <PageHeader
        title="New Container"
        description="Register a new import container with its Container No and BL No."
        actions={
          <Button asChild variant="outline">
            <Link href="/containers">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl p-6">
        <ContainerForm suppliers={suppliers} warehouses={warehouses} orgId={orgId} />
      </div>
    </div>
  );
}
