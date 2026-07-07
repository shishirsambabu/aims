import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { WarehouseManager } from "@/components/settings/WarehouseManager";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listWarehouses, type WarehouseRecord } from "@/lib/data/warehouses";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const session = await requireSession();
  const canEdit = can(session.role, "masterdata.write") || session.role === "admin";

  let warehouses: WarehouseRecord[] = [];
  let loadError = false;
  try {
    warehouses = await listWarehouses(session.orgId);
  } catch (err) {
    console.error("[settings/warehouses] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Warehouses"
        description="Register cold stores and assign containers before they enter stock."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <p className="text-muted-foreground">
              The database isn&apos;t reachable. Set a working <code>DATABASE_URL</code>.
            </p>
          </div>
        ) : (
          <WarehouseManager warehouses={warehouses} canEdit={canEdit} />
        )}
      </div>
    </div>
  );
}
