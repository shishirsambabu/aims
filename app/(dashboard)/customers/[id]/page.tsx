import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CreditCard,
  FileText,
  History,
  ShieldAlert,
  ShoppingCart,
  Users2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCustomerById, type CustomerRecord } from "@/lib/data/customers";
import { getCustomerLedger } from "@/lib/data/receivables";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { requirePageAccess } from "@/lib/page-access";
import {
  CUSTOMER_CLASS_DESCRIPTIONS,
  CUSTOMER_ONBOARDING_REQUIREMENTS,
  normalizeCustomerClass,
} from "@/lib/customer-segments";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerPage({ params }: PageProps) {
  const session = await requireSession();
  requirePageAccess(session.role, ["crm.view", "sales.view", "financials.view"]);
  const canAccess = true;
  const { id } = await params;

  let loadError = false;
  let customer: Awaited<ReturnType<typeof getCustomerById>> | null = null;
  let ledger: Awaited<ReturnType<typeof getCustomerLedger>> | null = null;

  try {
    [customer, ledger] = await Promise.all([
      getCustomerById(
        session.orgId,
        id,
        session.role === "sales_executive" ? session.userId : undefined
      ),
      getCustomerLedger(session.orgId, id),
    ]);
  } catch (err) {
    console.error("[customers/[id]/page] load failed", err);
    loadError = true;
  }

  if (!loadError && !customer) {
    notFound();
  }

  const limit = Number(customer?.creditLimit ?? 0);
  const outstanding = Number(ledger?.summary.outstanding ?? 0);
  const overdue = Number(ledger?.summary.overdue ?? 0);
  const utilization = limit > 0 ? Math.min((outstanding / limit) * 100, 999) : null;
  const headroom = limit > 0 ? Math.max(limit - outstanding, 0) : null;
  const riskTone =
    customer?.creditHold
      ? "danger"
      : utilization == null
        ? "neutral"
        : utilization >= 100
          ? "danger"
          : utilization >= 85
            ? "warning"
            : utilization >= 60
              ? "watch"
              : "success";
  const riskLabel =
    customer?.creditHold
      ? "Credit Hold"
      : utilization == null
        ? "No Limit"
        : utilization >= 100
          ? "Over Limit"
          : utilization >= 85
            ? "High Risk"
            : utilization >= 60
              ? "Watch"
              : "Healthy";
  const customerClass = normalizeCustomerClass(customer?.customerTier);
  const orderCount = ledger?.orders.length ?? 0;
  const receiptCount = ledger?.receipts.length ?? 0;
  const orderValue = Number(ledger?.summary.orderValue ?? 0);
  const receiptValue = Number(ledger?.summary.receiptValue ?? 0);
  const averageOrderValue = orderCount > 0 ? orderValue / orderCount : 0;
  const collectionRatio = orderValue > 0 ? Math.min((receiptValue / orderValue) * 100, 999) : null;
  const openOrderCount = ledger?.orders.filter((order) => order.outstanding > 0).length ?? 0;
  const lastOrderDate = ledger?.orders[0]?.orderDate ?? null;
  const sopReady =
    Boolean(customerClass) &&
    customer?.approvalStatus === "Approved" &&
    customer?.kycStatus === "Approved" &&
    !customer?.creditHold &&
    Boolean(customer?.assignedRepId) &&
    Boolean(customer?.creditReviewDate);

  return (
    <div>
      <PageHeader
        title={customer?.name ?? "Customer"}
        description="Account profile with credit exposure, orders, collections, and review history."
        actions={
          <Button asChild variant="outline">
            <Link href="/customers">
              <ArrowLeft className="h-4 w-4" /> Back to customers
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load customer details</p>
              <p className="text-muted-foreground">
                Customer details could not be loaded. Retry once; if it continues, ask an administrator to review the server log.
              </p>
            </div>
          </div>
        ) : !canAccess ? (
          <EmptyState
            icon={Users2}
            title="You do not have access to this customer"
            description="This account is limited to CRM, sales, and finance roles."
          />
        ) : !customer || !ledger ? (
          <EmptyState
            icon={Users2}
            title="Customer not found"
            description="This customer record may have been archived or removed."
          />
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="rounded-[1.5rem]">
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="label-caps">Customer account</p>
                      <h1 className="mt-1 font-heading text-3xl font-bold">
                        {customer.name}
                      </h1>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {customerClass
                          ? `${customerClass} account - ${CUSTOMER_CLASS_DESCRIPTIONS[customerClass]}`
                          : "Customer class not set. Classification is required before live sales."}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {customer.code} · {customer.tradeName ?? "No trade name"}
                      </p>
                    </div>
                    <RiskBadge label={riskLabel} tone={riskTone} />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Stat label="Credit Limit" value={formatINR(limit)} />
                    <Stat label="Outstanding" value={formatINR(outstanding)} />
                    <Stat label="Overdue" value={formatINR(overdue)} tone="text-danger" />
                    <Stat
                      label="Headroom"
                      value={headroom == null ? "—" : formatINR(headroom)}
                      tone={headroom != null && headroom < limit * 0.15 ? "text-warning" : undefined}
                    />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <MiniInfo label="GSTIN" value={customer.gstin ?? "Not set"} />
                    <MiniInfo label="PAN" value={customer.pan ?? "Not set"} />
                    <MiniInfo label="Region" value={customer.region ?? "Unassigned"} />
                    <MiniInfo label="Credit Hold" value={customer.creditHold ? "Yes" : "No"} />
                    <MiniInfo label="Customer Class" value={customer.customerTier ?? "Not classified"} />
                    <MiniInfo label="Payment Terms" value={`${customer.paymentTermsDays} days`} />
                    <MiniInfo
                      label="Next Credit Review"
                      value={customer.creditReviewDate ? formatDate(customer.creditReviewDate) : "Not scheduled"}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className={cn("rounded-[1.5rem]", riskTone === "danger" && "border-danger/30 bg-danger/5", riskTone === "warning" && "border-warning/30 bg-warning/10", riskTone === "watch" && "border-warning/20 bg-warning/5", riskTone === "success" && "border-success/25 bg-success/5")}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5 text-primary" />
                    <h2 className="font-heading text-lg font-semibold">
                      Risk summary
                    </h2>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Credit control is based on the limit versus current exposure.
                    This customer is currently at{" "}
                    <span className="font-semibold text-foreground">
                      {utilization == null ? "no defined utilization" : `${utilization.toFixed(1)}% utilization`}
                    </span>
                    .
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Stat label="Orders" value={ledger.orders.length.toString()} />
                    <Stat label="Collections" value={ledger.receipts.length.toString()} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Stat label="Avg Order Value" value={formatINR(averageOrderValue)} />
                    <Stat
                      label="Collection Ratio"
                      value={collectionRatio == null ? "No sales" : `${collectionRatio.toFixed(1)}%`}
                      tone={collectionRatio != null && collectionRatio < 75 ? "text-warning" : undefined}
                    />
                    <Stat label="Open Orders" value={openOrderCount.toString()} />
                    <Stat label="Last Order" value={lastOrderDate ? formatDate(lastOrderDate) : "No orders"} />
                  </div>
                  <div className="mt-4 rounded-2xl border border-border bg-card/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Risk bands
                    </p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <BandRow label="0-59%" text="Healthy" active={riskTone === "success"} />
                      <BandRow label="60-84%" text="Watch" active={riskTone === "watch"} />
                      <BandRow label="85-99%" text="High risk" active={riskTone === "warning"} />
                      <BandRow label="100%+" text="Over limit" active={riskTone === "danger"} />
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-[1.5rem]">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="label-caps">Customer onboarding SOP</p>
                    <h2 className="mt-1 font-heading text-lg font-semibold">
                      {customerClass ?? "Classification required"}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {customerClass
                        ? CUSTOMER_CLASS_DESCRIPTIONS[customerClass]
                        : "Select a customer class in CRM before this account is treated as sales-ready."}
                    </p>
                  </div>
                  <RiskBadge
                    label={sopReady ? "SOP Ready" : "SOP Pending"}
                    tone={sopReady ? "success" : "warning"}
                  />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(customerClass
                    ? CUSTOMER_ONBOARDING_REQUIREMENTS[customerClass]
                    : [
                        "Select customer class",
                        "Verify GSTIN and PAN",
                        "Set credit limit, payment terms, and next review date",
                        "Assign sales rep, region, and primary contact",
                      ]
                  ).map((requirement) => (
                    <div key={requirement} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
                      {requirement}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-[1.5rem]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="label-caps">Order history</p>
                      <h2 className="mt-1 font-heading text-lg font-semibold">
                        Approved sales orders
                      </h2>
                    </div>
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface">
                        <tr className="text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Order</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium text-right">Net</th>
                          <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.orders.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8">
                              <EmptyState
                                icon={ShoppingCart}
                                title="No orders yet"
                                description="Approved orders will appear here once the customer starts buying."
                                className="border-0 bg-transparent py-4"
                              />
                            </td>
                          </tr>
                        ) : (
                          ledger.orders.map((order) => (
                            <tr key={order.id} className="border-t border-border/60">
                              <td className="px-4 py-3 font-medium">{order.orderNo}</td>
                              <td className="px-4 py-3 font-financial">{order.orderDate}</td>
                              <td className="px-4 py-3 text-right font-financial">{formatINR(order.netAmount)}</td>
                              <td className={cn("px-4 py-3 text-right font-financial", order.outstanding > 0 ? "text-danger" : "text-success")}>{formatINR(order.outstanding)}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                  {order.approvalStatus}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="label-caps">Collections</p>
                      <h2 className="mt-1 font-heading text-lg font-semibold">
                        Receipts and allocation trail
                      </h2>
                    </div>
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <MiniInfo label="Order value" value={formatINR(ledger.summary.orderValue)} />
                    <MiniInfo label="Receipt value" value={formatINR(ledger.summary.receiptValue)} />
                    <MiniInfo label="Oldest due" value={ledger.summary.oldestDueDate ? formatDate(ledger.summary.oldestDueDate) : "—"} />
                    <MiniInfo label="Aging" value={ledger.summary.oldestAgeDays == null ? "—" : `${ledger.summary.oldestAgeDays} days`} />
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface">
                        <tr className="text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Receipt</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium text-right">Amount</th>
                          <th className="px-4 py-3 font-medium">Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.receipts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8">
                              <EmptyState
                                icon={FileText}
                                title="No collections yet"
                                description="Posted receipts will show here with their allocations."
                                className="border-0 bg-transparent py-4"
                              />
                            </td>
                          </tr>
                        ) : (
                          ledger.receipts.map((receipt) => (
                            <tr key={receipt.id} className="border-t border-border/60">
                              <td className="px-4 py-3 font-medium">{receipt.receiptNo}</td>
                              <td className="px-4 py-3 font-financial">{receipt.receiptDate}</td>
                              <td className="px-4 py-3 text-right font-financial">{formatINR(receipt.amount)}</td>
                              <td className="px-4 py-3">{receipt.method}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-[1.5rem]">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Users2 className="h-5 w-5 text-primary" />
                    <h2 className="font-heading text-lg font-semibold">
                      Contacts and account owners
                    </h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {customer.contacts.length === 0 ? (
                      <EmptyState
                        icon={Users2}
                        title="No contacts yet"
                        description="Add primary and secondary contacts for this account."
                        className="border-0 bg-transparent py-4"
                      />
                    ) : (
                      customer.contacts.map((contact) => (
                        <div key={contact.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{contact.name}</p>
                            {contact.isPrimary && (
                              <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {contact.designation ?? "No designation"}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {contact.phone ?? "No phone"} · {contact.email ?? "No email"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[1.5rem]">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-primary" />
                    <h2 className="font-heading text-lg font-semibold">
                      Credit hold trail
                    </h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {customer.creditHoldTrail.length === 0 ? (
                      <EmptyState
                        icon={History}
                        title="No hold changes recorded"
                        description="Credit hold overrides and reasons will appear here."
                        className="border-0 bg-transparent py-4"
                      />
                    ) : (
                      customer.creditHoldTrail.map((entry) => (
                        <div key={entry.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">
                              {entry.from ? "Hold on" : "Hold off"} → {entry.to ? "Hold on" : "Hold off"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.createdAt ? formatDate(entry.createdAt) : "—"}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {entry.reason ?? "No reason provided"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.user ?? "System"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-[1.5rem]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="label-caps">Activity trail</p>
                    <h2 className="mt-1 font-heading text-lg font-semibold">
                      Review and approval history
                    </h2>
                  </div>
                  <CalendarClock className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 space-y-3">
                  {customer.activityTimeline.length === 0 ? (
                    <EmptyState
                      icon={CalendarClock}
                      title="No activity yet"
                      description="Activity logs will show customer updates, approvals, and changes."
                      className="border-0 bg-transparent py-4"
                    />
                  ) : (
                    customer.activityTimeline.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{entry.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.createdAt ? formatDate(entry.createdAt) : "—"}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {entry.summary ?? "No summary"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.user ?? "System"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-financial mt-1 text-xl font-bold", tone)}>{value}</p>
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function BandRow({
  label,
  text,
  active,
}: {
  label: string;
  text: string;
  active: boolean;
}) {
  return (
    <li className={cn("flex items-center justify-between rounded-xl px-3 py-2", active && "bg-primary/10")}>
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{text}</span>
    </li>
  );
}

function RiskBadge({
  label,
  tone,
}: {
  label: string;
  tone: "danger" | "warning" | "watch" | "success" | "neutral";
}) {
  const styles: Record<typeof tone, string> = {
    danger: "bg-danger/10 text-danger border-danger/20",
    warning: "bg-warning/15 text-[#9A6212] border-warning/20",
    watch: "bg-warning/10 text-[#9A6212] border-warning/15",
    success: "bg-success/10 text-success border-success/20",
    neutral: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide", styles[tone])}>
      {label}
    </span>
  );
}
