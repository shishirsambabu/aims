import { notFound, redirect } from "next/navigation";

import { PrintBar } from "@/components/reports/PrintBar";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { getContainerPnL } from "@/lib/data/reports";
import {
  cn,
  formatINR,
  formatUSD,
  formatDate,
  marginColor,
} from "@/lib/utils";
import { CONTAINER_STATUS_LABELS } from "@/lib/constants";
import type { ContainerStatus } from "@/types";

export const dynamic = "force-dynamic";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

interface PageProps {
  params: { id: string };
}

export default async function ContainerPnLPrint({ params }: PageProps) {
  const session = await requireSession();
  if (!can(session.role, "financials.view")) redirect("/containers");

  const c = await getContainerPnL(session.orgId, params.id);
  if (!c) notFound();

  await logActivity({
    orgId: session.orgId,
    userId: session.userId,
    action: "viewed_pnl",
    entityType: "container",
    entityId: c.id,
    summary: `Viewed P&L for ${c.containerNo}`,
  });

  const cost = c.cost ?? {};
  const sale = c.sale ?? {};
  const profit = num(sale.profit);
  const margin = num(sale.marginPct);

  const costRows: { label: string; key: string }[] = [
    { label: "BE Invoice Value (INR)", key: "beInvoiceValueInr" },
    { label: "Customs Duty", key: "customsDuty" },
    { label: "Clearing Charges", key: "clearingCharges" },
    { label: "Liner Charges", key: "linerCharges" },
    { label: "Detention", key: "detention" },
    { label: "CHA Charges", key: "chaCharges" },
    { label: "Transport", key: "transport" },
    { label: "Other Charges", key: "otherCharges" },
    { label: "OH Proportion", key: "ohProportion" },
    { label: "Claim Deduction", key: "claimDeduction" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8 print:p-0">
      <PrintBar backHref={`/containers/${c.id}`} />

      <div className="rounded-lg border border-border bg-white p-8 print:border-0">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <h1 className="font-heading text-xl font-bold">
              Aeden Fruits International Pvt Ltd
            </h1>
            <p className="text-sm text-muted-foreground">
              Import P&amp;L Statement · Kochi, Kerala
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-financial font-semibold">{c.containerNo}</p>
            <p className="font-financial text-muted-foreground">BL {c.blNo}</p>
          </div>
        </div>

        {/* Meta */}
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 py-4 text-sm sm:grid-cols-3">
          <Meta label="Supplier" value={c.supplier?.name} />
          <Meta label="Customer" value={c.customer} />
          <Meta
            label="Port"
            value={c.port ? `${c.port}${c.portCode ? ` (${c.portCode})` : ""}` : null}
          />
          <Meta label="Item" value={c.item} />
          <Meta
            label="Status"
            value={CONTAINER_STATUS_LABELS[c.status as ContainerStatus]}
          />
          <Meta label="Boxes" value={c.noOfBoxes?.toLocaleString("en-IN")} />
          <Meta label="ETA" value={formatDate(c.eta)} />
          <Meta label="BE No" value={c.shipmentItem?.beNo} />
          <Meta
            label="Invoice (USD)"
            value={formatUSD(num(c.shipmentItem?.invoiceValue))}
          />
        </dl>

        {/* Costs */}
        <section className="py-2">
          <h2 className="mb-2 font-heading text-base font-semibold">
            Landing Costs (INR)
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {costRows.map((r) => (
                <tr key={r.key} className="border-b border-border/50">
                  <td className="py-1.5 text-muted-foreground">{r.label}</td>
                  <td className="font-financial py-1.5 text-right">
                    {formatINR(num(cost[r.key]))}
                  </td>
                </tr>
              ))}
              <tr className="border-b-2 border-border font-semibold">
                <td className="py-2">Total Cost</td>
                <td className="font-financial py-2 text-right">
                  {formatINR(num(cost.totalCost))}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-muted-foreground">Rate / Box (Final)</td>
                <td className="font-financial py-1.5 text-right">
                  {formatINR(num(cost.ratePerBox))}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Sales & profit */}
        <section className="py-2">
          <h2 className="mb-2 font-heading text-base font-semibold">
            Sales &amp; Profit
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <Row label="Sold Qty" value={num(sale.soldQty)?.toLocaleString("en-IN")} />
              <Row label="Avg Price / Box" value={formatINR(num(sale.avgPrice))} />
              <Row label="Sale Value" value={formatINR(num(sale.saleValue))} strong />
              <Row label="Damage Value" value={formatINR(num(sale.damageValue))} />
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
            <Big label="Profit / Container" value={formatINR(profit)} tone={profit != null && profit < 0 ? "text-danger" : "text-success"} />
            <Big label="Profit / Box" value={formatINR(num(sale.profitPerBox))} />
            <Big label="Margin" value={margin != null ? `${margin.toFixed(1)}%` : "—"} tone={marginColor(margin)} />
          </div>
        </section>

        <p className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
          Generated by AIMS on {formatDate(new Date())}. Figures in INR unless
          noted.
        </p>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-financial">{value ?? "—"}</dd>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <tr className="border-b border-border/50">
      <td className={cn("py-1.5", strong ? "font-semibold" : "text-muted-foreground")}>{label}</td>
      <td className={cn("font-financial py-1.5 text-right", strong && "font-semibold")}>{value ?? "—"}</td>
    </tr>
  );
}

function Big({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-financial text-lg font-bold", tone)}>{value}</p>
    </div>
  );
}
