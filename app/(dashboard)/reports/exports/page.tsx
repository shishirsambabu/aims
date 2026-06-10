import { FileSpreadsheet, FileText, Lock, Send } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ExportCenterPage() {
  const session = await requireSession();
  const canExport = can(session.role, "financials.view");

  if (!canExport) {
    return (
      <div>
        <PageHeader
          title="Export Center"
          description="Management report exports."
        />
        <div className="m-6 flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> You do not have access to financial
          exports.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Export Center"
        description="Phase 23 foundation for Excel, CSV, PDF and scheduled management packs."
      />
      <div className="grid gap-4 p-6 lg:grid-cols-3">
        <ExportCard
          icon={FileSpreadsheet}
          title="Management Excel Pack"
          status="Live"
          description="Summary, supplier performance, port performance and AP aging."
          href="/api/reports/management?format=xlsx"
          cta="Download Excel"
        />
        <ExportCard
          icon={FileSpreadsheet}
          title="Management CSV"
          status="Live"
          description="CSV version of the management report for quick sharing."
          href="/api/reports/management?format=csv"
          cta="Download CSV"
        />
        <ExportCard
          icon={FileText}
          title="PDF Report Pack"
          status="Live"
          description="Server-generated management PDF for sharing with leadership."
          href="/api/reports/management?format=pdf"
          cta="Download PDF"
        />
        <ExportCard
          icon={Send}
          title="Scheduled Email Reports"
          status="Deferred"
          description="Requires email provider decision; parked with GoDaddy/custom domain email TODO."
        />
      </div>
    </div>
  );
}

function ExportCard({
  icon: Icon,
  title,
  status,
  description,
  href,
  cta,
}: {
  icon: typeof FileSpreadsheet;
  title: string;
  status: string;
  description: string;
  href?: string;
  cta?: string;
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading font-semibold">{title}</h3>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {status}
            </p>
          </div>
        </div>
        <p className="mt-4 flex-1 text-sm text-muted-foreground">
          {description}
        </p>
        {href && cta ? (
          <Button asChild className="mt-5">
            <a href={href}>{cta}</a>
          </Button>
        ) : (
          <Button className="mt-5" variant="outline" disabled>
            Coming soon
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
