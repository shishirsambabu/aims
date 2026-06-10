import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  FileWarning,
  CreditCard,
  TrendingDown,
  Flag,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { getAlerts, type AlertCategory, type AlertItem } from "@/lib/data/notifications";

export const dynamic = "force-dynamic";

const GROUPS: { key: AlertCategory; label: string; icon: LucideIcon }[] = [
  { key: "arrival", label: "Arrival Confirmation (set ATA)", icon: Clock },
  { key: "demurrage", label: "Demurrage / Detention Risk", icon: Clock },
  { key: "paymentOverdue", label: "Overdue Payments", icon: CreditCard },
  { key: "lossMaking", label: "Loss-Making Containers", icon: TrendingDown },
  { key: "approval", label: "Payments Awaiting Approval", icon: CreditCard },
  { key: "docExpiry", label: "Expiring Documents", icon: FileWarning },
  { key: "flagged", label: "Flagged Containers", icon: Flag },
];

export default async function AlertsPage() {
  const session = await requireSession();

  let alerts: AlertItem[] = [];
  let loadError = false;
  try {
    alerts = await getAlerts(session.orgId);
  } catch {
    loadError = true;
  }

  const byGroup = (cat: AlertCategory) => alerts.filter((a) => a.category === cat);

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Demurrage risk, expiring documents, overdue & pending payments, and loss-making containers — all in one place."
      />
      <div className="space-y-6 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <p className="text-muted-foreground">
              The database isn&apos;t reachable. Set a working{" "}
              <code>DATABASE_URL</code> and apply migrations.
            </p>
          </div>
        ) : alerts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-success/10 p-4 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="font-heading text-lg font-semibold">All clear</p>
              <p className="max-w-md text-sm text-muted-foreground">
                No demurrage risk, expiring documents, overdue payments or
                loss-making containers right now.
              </p>
            </CardContent>
          </Card>
        ) : (
          GROUPS.map((g) => {
            const items = byGroup(g.key);
            if (items.length === 0) return null;
            const Icon = g.icon;
            return (
              <Card key={g.key}>
                <CardContent className="pt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="font-heading text-base font-semibold">
                      {g.label}
                    </h3>
                    <span className="font-financial rounded-full bg-surface-alt px-2 py-0.5 text-xs text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {items.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={a.href}
                          className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-alt/40"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                a.severity === "critical"
                                  ? "bg-danger"
                                  : "bg-warning"
                              )}
                            />
                            <div>
                              <p className="text-sm font-medium">{a.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {a.subtitle}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              a.severity === "critical"
                                ? "bg-danger/10 text-danger"
                                : "bg-warning/20 text-[#9A6212]"
                            )}
                          >
                            {a.severity === "critical" ? "Critical" : "Warning"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
