import Link from "next/link";
import {
  Package,
  FileWarning,
  CreditCard,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const KPIS = [
  {
    label: "Active Containers",
    value: "—",
    icon: Package,
    accent: "border-t-primary",
    hint: "Across all ports",
  },
  {
    label: "Total Profit (FY)",
    value: "—",
    icon: TrendingUp,
    accent: "border-t-success",
    hint: "Net of damages",
  },
  {
    label: "Pending Documents",
    value: "—",
    icon: FileWarning,
    accent: "border-t-warning",
    hint: "Expiring within 30 days",
  },
  {
    label: "Outstanding Payments",
    value: "—",
    icon: CreditCard,
    accent: "border-t-danger",
    hint: "Awaiting settlement",
  },
];

export default function DashboardHome() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of imports, costs, documentation and profit."
        actions={
          <Button asChild>
            <Link href="/containers">
              View Containers <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card
                key={kpi.label}
                className={`border-t-4 ${kpi.accent}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {kpi.label}
                      </p>
                      <p className="font-financial mt-2 text-3xl font-bold">
                        {kpi.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {kpi.hint}
                      </p>
                    </div>
                    <div className="rounded-md bg-surface-alt p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Phase 1 status panel */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome to AIMS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Foundation is in place: authentication, the enterprise layout
              shell, the design system and the full database schema. Live data
              lights up as the Container Tracker and finance modules come online
              in the next phases.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/containers">Containers</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/documents">Documents</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/analytics">Analytics</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
