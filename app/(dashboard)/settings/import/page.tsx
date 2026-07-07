import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportWizard } from "@/components/settings/ImportWizard";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await requireSession();

  if (!can(session.role, "import")) {
    return (
      <div>
        <PageHeader title="Import" description="Bulk-load from your tracker sheet." />
        <div className="p-6">
          <EmptyState
            icon={Lock}
            title="Import is restricted"
            description="Only managers and admins can bulk-load tracker sheets into AIMS."
          />
        </div>
      </div>
    );
  }

  let existingNos: string[] = [];
  let existingBlNos: string[] = [];
  try {
    const rows: { containerNo: string; blNo: string }[] = await prisma.container.findMany({
      where: { orgId: session.orgId },
      select: { containerNo: true, blNo: true },
    });
    existingNos = rows.map((r) => r.containerNo);
    existingBlNos = rows.map((r) => r.blNo);
  } catch (err) {
    console.error("[settings/import] load failed", err);
  }

  return (
    <div>
      <PageHeader
        title="Excel Import"
        description="Upload your existing tracker sheet — columns are auto-mapped, duplicates skipped."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-4xl p-6">
        <ImportWizard existingNos={existingNos} existingBlNos={existingBlNos} />
      </div>
    </div>
  );
}
