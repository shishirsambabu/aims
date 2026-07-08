import { PageHeader } from "@/components/layout/PageHeader";
import { FeatureFlagManager } from "@/components/settings/FeatureFlagManager";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["team.manage"]);

  let flags: { key: string; enabled: boolean; description: string | null }[] = [];
  let loadError = false;
  try {
    flags = await prisma.featureFlag.findMany({
      where: { orgId: session.orgId },
      orderBy: { key: "asc" },
      select: { key: true, enabled: true, description: true },
    });
  } catch (err) {
    console.error("[settings/flags] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Feature Flags"
        description="Kill switches and staged rollouts. maintenance_mode shows a banner to every user while enabled."
      />
      <div className="p-6">
        {loadError ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-muted-foreground">
            Couldn&apos;t load feature flags. Check the database connection and retry.
          </div>
        ) : (
          <FeatureFlagManager initialFlags={flags} />
        )}
      </div>
    </div>
  );
}
