import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listCustomers, type CustomerRecord } from "@/lib/data/customers";
import {
  getCrmSummary,
  listCrmLeads,
  listCrmOpportunities,
  listCrmTasks,
  listCrmOwners,
  type CrmBoardSummary,
  type CrmLeadRow,
  type CrmOpportunityRow,
  type CrmTaskRow,
} from "@/lib/data/crm";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["crm.view"]);

  let loadError = false;
  let summary: CrmBoardSummary = { leads: 0, openLeads: 0, opportunities: 0, openTasks: 0, dueTasks: 0 };
  let leads: CrmLeadRow[] = [];
  let opportunities: CrmOpportunityRow[] = [];
  let tasks: CrmTaskRow[] = [];
  let customers: CustomerRecord[] = [];
  let owners: Awaited<ReturnType<typeof listCrmOwners>> = [];
  const scope = session.role === "sales_executive" ? { userId: session.userId } : {};

  try {
    [summary, leads, opportunities, tasks, customers, owners] = await Promise.all([
      getCrmSummary(session.orgId, scope),
      listCrmLeads(session.orgId, scope),
      listCrmOpportunities(session.orgId, scope),
      listCrmTasks(session.orgId, scope),
      listCustomers(
        session.orgId,
        session.role === "sales_executive" ? session.userId : undefined
      ),
      listCrmOwners(session.orgId),
    ]);
  } catch (err) {
    console.error("[crm/page] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="CRM Pipeline"
        description="Track leads, opportunities, follow-ups, and task reminders in one account-centric view."
      />

      <div className="space-y-4 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load CRM data</p>
              <p className="text-muted-foreground">
                CRM data could not be loaded. Retry once; if it continues, ask an administrator to review the server log.
              </p>
            </div>
          </div>
        ) : (
          <CrmWorkspace
            summary={summary}
            leads={leads}
            opportunities={opportunities}
            tasks={tasks}
            customers={customers}
            owners={owners}
          />
        )}
      </div>
    </div>
  );
}
