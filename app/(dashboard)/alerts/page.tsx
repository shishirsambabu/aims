import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  CreditCard,
  FileWarning,
  Flag,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

import { AlertActions } from "@/components/alerts/AlertActions";
import { AlertPreferences } from "@/components/alerts/AlertPreferences";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import {
  ALERT_CATEGORY_LABELS,
  getPersonalAlerts,
  type AlertCategory,
  type PersonalAlertItem,
  type PersonalAlertSummary,
} from "@/lib/data/notifications";

export const dynamic = "force-dynamic";

const GROUP_ICONS: Record<AlertCategory, LucideIcon> = {
  arrival: Clock,
  demurrage: Clock,
  paymentOverdue: CreditCard,
  lossMaking: TrendingDown,
  approval: CreditCard,
  docExpiry: FileWarning,
  flagged: Flag,
};

const GROUP_ORDER: AlertCategory[] = [
  "arrival",
  "demurrage",
  "paymentOverdue",
  "approval",
  "docExpiry",
  "lossMaking",
  "flagged",
];

export default async function AlertsPage() {
  const session = await requireSession();

  let personal: PersonalAlertSummary | null = null;
  let loadError = false;
  try {
    personal = await getPersonalAlerts(session);
  } catch {
    loadError = true;
  }

  const active = personal?.active ?? [];
  const byGroup = (cat: AlertCategory) =>
    active.filter((a) => a.category === cat);

  return (
    <div>
      <PageHeader
        title="My Alert Center"
        description="Your role-aware queue for detention risk, document deadlines, payment approvals and operational exceptions."
      />
      <div className="space-y-6 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <p className="text-muted-foreground">
              The database is not reachable. Set a working{" "}
              <code>DATABASE_URL</code> and apply migrations.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Active" value={active.length} icon={BellRing} />
              <SummaryCard
                label="Critical"
                value={personal?.criticalCount ?? 0}
                icon={AlertTriangle}
                tone="danger"
              />
              <SummaryCard
                label="Snoozed"
                value={personal?.snoozed.length ?? 0}
                icon={Clock}
              />
            </div>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <div>
                  <h3 className="font-heading text-base font-semibold">
                    My alert preferences
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Hide categories that are not useful for your personal queue.
                  </p>
                </div>
                <AlertPreferences preferences={personal?.preferences ?? []} />
              </CardContent>
            </Card>

            {active.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <div className="rounded-full bg-success/10 p-4 text-success">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <p className="font-heading text-lg font-semibold">
                    All clear for your role
                  </p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    You have no active alerts after role routing, preferences,
                    snoozes and resolved items are applied.
                  </p>
                </CardContent>
              </Card>
            ) : (
              GROUP_ORDER.map((category) => {
                const items = byGroup(category);
                if (items.length === 0) return null;
                const Icon = GROUP_ICONS[category];
                return (
                  <Card key={category}>
                    <CardContent className="pt-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <h3 className="font-heading text-base font-semibold">
                          {ALERT_CATEGORY_LABELS[category]}
                        </h3>
                        <span className="font-financial rounded-full bg-surface-alt px-2 py-0.5 text-xs text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                      <ul className="divide-y divide-border">
                        {items.map((a) => (
                          <AlertRow key={a.id} alert={a} />
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: PersonalAlertItem }) {
  return (
    <li className="py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link href={alert.href} className="group flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-2 h-2 w-2 shrink-0 rounded-full",
              alert.severity === "critical" ? "bg-danger" : "bg-warning"
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium group-hover:text-primary">
                {alert.title}
              </p>
              {alert.isUnread && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  New
                </span>
              )}
              {alert.dueLabel && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    alert.severity === "critical"
                      ? "bg-danger/10 text-danger"
                      : "bg-warning/20 text-[#9A6212]"
                  )}
                >
                  {alert.dueLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{alert.subtitle}</p>
            <p className="mt-1 text-xs font-medium text-primary">
              Next action: {alert.primaryAction}
            </p>
          </div>
        </Link>
        <AlertActions alertKey={alert.id} category={alert.category} compact />
      </div>
    </li>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "danger";
}) {
  return (
    <Card className={cn(tone === "danger" && "border-danger/30 bg-danger/5")}>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="label-caps">{label}</p>
          <p
            className={cn(
              "font-financial mt-1 text-3xl font-bold",
              tone === "danger" && "text-danger"
            )}
          >
            {value}
          </p>
        </div>
        <div
          className={cn(
            "rounded-xl bg-primary/10 p-3 text-primary",
            tone === "danger" && "bg-danger/10 text-danger"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
