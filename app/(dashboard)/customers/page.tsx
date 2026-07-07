import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  listCustomers,
  getSalesRepOptions,
  type CustomerRecord,
} from "@/lib/data/customers";
import { CustomerManager } from "@/components/customers/CustomerManager";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["crm.view", "sales.view", "financials.view"]);
  const canAccess = true;

  let customers: CustomerRecord[] = [];
  let reps: Awaited<ReturnType<typeof getSalesRepOptions>> = [];
  let loadError = false;

  try {
    [customers, reps] = await Promise.all([
      listCustomers(
        session.orgId,
        session.role === "sales_executive" ? session.userId : undefined
      ),
      getSalesRepOptions(session.orgId),
    ]);
  } catch (err) {
    console.error("[customers/page] load failed", err);
    loadError = true;
  }

  const totalCustomers = customers.length;
  const pendingCustomers = customers.filter(
    (row) => row.approvalStatus === "PendingApproval"
  ).length;
  const creditHoldCustomers = customers.filter((row) => row.creditHold).length;
  const approvedCustomers = customers.filter(
    (row) => row.approvalStatus === "Approved"
  ).length;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Onboard buyers, lock KYC, assign reps, and control credit exposure."
      />

      <div className="space-y-4 p-6">
        {!loadError && canAccess ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Customers" value={totalCustomers.toString()} hint="Master records" />
            <StatCard label="Pending" value={pendingCustomers.toString()} hint="Needs review" />
            <StatCard
              label="Credit Hold"
              value={creditHoldCustomers.toString()}
              hint="Blocked for billing"
            />
            <StatCard
              label="Approved"
              value={approvedCustomers.toString()}
              hint="Ready for orders"
            />
          </div>
        ) : null}

        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load customers</p>
              <p className="text-muted-foreground">
                Customer data could not be loaded. Retry once; if it continues, ask an administrator to review the server log.
              </p>
            </div>
          </div>
        ) : !canAccess ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            You do not have permission to view customer master data.
          </div>
        ) : (
          <CustomerManager
            customers={customers}
            reps={reps}
            canEdit={can(session.role, "crm.write")}
            canApprove={
              can(session.role, "crm.kyc.approve") ||
              can(session.role, "masterdata.approve")
            }
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-financial mt-1 text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
