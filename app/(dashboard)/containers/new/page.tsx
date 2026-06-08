import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ContainerForm } from "@/components/containers/ContainerForm";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewContainerPage() {
  const { orgId } = await requireSession();

  let suppliers: { id: string; name: string }[] = [];
  try {
    suppliers = await prisma.supplier.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch (err) {
    console.error("[containers/new] supplier load failed", err);
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
        <ContainerForm suppliers={suppliers} />
      </div>
    </div>
  );
}
