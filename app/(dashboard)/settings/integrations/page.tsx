import { Plug, ShieldCheck, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  { key: "outlook", name: "Outlook / Microsoft Graph", note: "Admin setup tomorrow" },
  { key: "tally", name: "Tally", note: "Adapter foundation ready" },
  { key: "icegate", name: "ICEGATE", note: "Needs feasibility/legal confirmation" },
  { key: "carrier", name: "Carrier Status", note: "Start with event ingestion" },
  { key: "ocr", name: "OCR Provider", note: "Provider choice pending" },
];

export default async function IntegrationsPage() {
  const session = await requireSession();
  const canManage = can(session.role, "masterdata.write") || session.role === "admin";

  const rows = canManage
    ? await prisma.integrationConnection.findMany({
        where: { orgId: session.orgId },
        orderBy: { provider: "asc" },
        include: {
          runs: { orderBy: { createdAt: "desc" }, take: 1 },
          errors: { where: { resolvedAt: null }, take: 3 },
        },
      })
    : [];
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Manage external connections for Outlook, Tally, ICEGATE, carriers and OCR providers."
      />
      <div className="space-y-6 p-6">
        {!canManage ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              Only admins and master-data managers can configure integrations.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-start gap-3 pt-6">
                <ShieldCheck className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-heading text-base font-semibold">
                    Integration foundation is ready
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Credentials are intentionally not stored here yet. The app
                    now has provider records, sync runs, sync errors and external
                    references so adapters can be added safely.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {PROVIDERS.map((provider) => {
                const row = byProvider.get(provider.key);
                const latestRun = row?.runs[0];
                return (
                  <Card key={provider.key}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-primary/10 p-3 text-primary">
                            <Plug className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-heading font-semibold">
                              {provider.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {provider.note}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {row?.status ?? "NotConnected"}
                        </span>
                      </div>
                      <div className="mt-4 rounded-lg border border-border bg-surface-alt p-3 text-xs text-muted-foreground">
                        <p>Last sync: {formatDate(row?.lastSyncAt ?? null)}</p>
                        <p>Last test: {formatDate(row?.lastTestAt ?? null)}</p>
                        <p>Latest run: {latestRun?.status ?? "No runs yet"}</p>
                      </div>
                      {row?.errorMessage && (
                        <div className="mt-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-[#9A6212]" />
                          <span className="text-muted-foreground">
                            {row.errorMessage}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
