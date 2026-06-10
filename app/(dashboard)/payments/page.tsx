import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentFilters } from "@/components/payments/PaymentFilters";
import { PaymentForm } from "@/components/payments/PaymentForm";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  listPayments,
  paymentSummaryByCurrency,
  type PaymentRow,
  type CurrencySummary,
} from "@/lib/data/payments";
import { containerOptions } from "@/lib/data/documents";
import { formatMoney } from "@/lib/utils";
import type { PaymentStatus } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; containerId?: string }>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await requireSession();
  const perms = {
    canCreate: can(session.role, "payment.write"),
    canPay: can(session.role, "payment.pay"),
    canApprove: can(session.role, "payment.approve"),
    userId: session.userId,
  };
  const editable = perms.canCreate;
  const filters = {
    q: params.q,
    status: params.status as PaymentStatus | undefined,
    containerId: params.containerId,
  };

  let rows: PaymentRow[] = [];
  let byCurrency: CurrencySummary[] = [];
  let containers: Awaited<ReturnType<typeof containerOptions>> = [];
  let loadError = false;

  try {
    [rows, byCurrency, containers] = await Promise.all([
      listPayments(session.orgId, filters),
      paymentSummaryByCurrency(session.orgId, filters),
      containerOptions(session.orgId),
    ]);
  } catch (err) {
    console.error("[payments/page] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Supplier payment requests and settlement tracking."
        actions={editable && <PaymentForm containers={containers} />}
      />

      <div className="space-y-4 p-6">
        {!loadError && (
          <div className="space-y-2">
            {byCurrency.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payment requests yet.
              </p>
            ) : (
              byCurrency.map((s) => (
                <div key={s.currency} className="grid gap-4 sm:grid-cols-3">
                  <SummaryCard
                    label={`Outstanding (${s.currency})`}
                    value={formatMoney(s.totalOutstanding, s.currency)}
                    accent="border-t-danger"
                    tone="text-danger"
                  />
                  <SummaryCard
                    label={`Paid (${s.currency})`}
                    value={formatMoney(s.totalPaid, s.currency)}
                    accent="border-t-success"
                    tone="text-success"
                  />
                  <SummaryCard
                    label={`Requested (${s.currency})`}
                    value={formatMoney(s.totalRequested, s.currency)}
                    accent="border-t-primary"
                  />
                </div>
              ))
            )}
          </div>
        )}

        <PaymentFilters />

        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load payments</p>
              <p className="text-muted-foreground">
                The database isn&apos;t reachable from this environment. Set a
                reachable <code>DATABASE_URL</code> and apply migrations.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {rows.length} payment request{rows.length === 1 ? "" : "s"} ·
              totals grouped by currency
            </p>
            <PaymentsTable
              data={rows}
              canPay={perms.canPay}
              canApprove={perms.canApprove}
              currentUserId={perms.userId}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent: string;
  tone?: string;
}) {
  return (
    <Card className={`border-t-4 ${accent}`}>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`font-financial mt-1 text-2xl font-bold ${tone ?? ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
