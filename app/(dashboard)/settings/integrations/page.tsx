import { Lock } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { IntegrationsWorkspace } from "@/components/integrations/IntegrationsWorkspace";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await requireSession();
  const canManage = can(session.role, "masterdata.write") || session.role === "admin";

  const rows = canManage
    ? await prisma.integrationConnection.findMany({
        where: { orgId: session.orgId },
        orderBy: { provider: "asc" },
        include: {
          runs: { orderBy: { createdAt: "desc" }, take: 5 },
          errors: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 5 },
        },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Manage the bridge layer for warehouse systems, Tally, Outlook, ICEGATE and OCR providers."
      />

      <div className="space-y-6 p-6">
        {!canManage ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={Lock}
                title="Integration settings are restricted"
                description="Only admins and master-data managers can configure external provider connections."
                className="border-0 bg-transparent"
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <p className="label-caps">Bridge Layer</p>
                <h3 className="font-heading text-base font-semibold">
                  WMS-ready integration foundation
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with a narrow warehouse bridge: container identities, warehouse
                  assignment, stock events, dispatch updates and receipt references.
                  Keep credentials minimal until the first pilot is stable.
                </p>
              </CardContent>
            </Card>

            <IntegrationsWorkspace initialConnections={rows} />
          </>
        )}
      </div>
    </div>
  );
}
