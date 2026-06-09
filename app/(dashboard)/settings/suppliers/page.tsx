import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SupplierManager } from "@/components/settings/SupplierManager";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listSuppliers, type SupplierRecord } from "@/lib/data/suppliers";
import { PORTS, CUSTOMERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function MasterDataPage() {
  const session = await requireSession();
  const canEdit = can(session.role, "masterdata.write");

  let suppliers: SupplierRecord[] = [];
  let loadError = false;
  try {
    suppliers = await listSuppliers(session.orgId);
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Master Data"
        description="Suppliers and reference data used across containers, documents and imports."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        <div>
          <h2 className="mb-3 font-heading text-lg font-semibold">Suppliers</h2>
          {loadError ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
              <p className="text-muted-foreground">
                The database isn&apos;t reachable. Set a working{" "}
                <code>DATABASE_URL</code>.
              </p>
            </div>
          ) : (
            <SupplierManager suppliers={suppliers} canEdit={canEdit} />
          )}
        </div>

        {/* Reference data */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-3 font-heading text-base font-semibold">Ports</h3>
              <ul className="space-y-1.5 text-sm">
                {PORTS.map((p) => (
                  <li key={p.code} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="font-financial text-muted-foreground">
                      {p.code}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Reference list (configured in code). Ask to add a port and it&apos;s
                a one-line change.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-3 font-heading text-base font-semibold">
                Customers
              </h3>
              <ul className="space-y-1.5 text-sm">
                {CUSTOMERS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
