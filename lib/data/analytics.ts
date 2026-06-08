import "server-only";

import { prisma } from "@/lib/prisma";

export interface AnalyticsKpis {
  totalContainers: number;
  totalInvoiceValueInr: number;
  totalProfit: number;
  avgMargin: number | null;
  pendingDocs: number;
  outstandingUsd: number;
}

export interface NameValue {
  name: string;
  value: number;
}

export interface ContainerProfitRow {
  containerNo: string;
  supplier: string | null;
  profit: number;
  marginPct: number | null;
}

export interface SupplierSummaryRow {
  supplier: string;
  containers: number;
  profit: number;
  avgMargin: number | null;
}

export interface Analytics {
  kpis: AnalyticsKpis;
  profitByContainer: NameValue[];
  profitBySupplier: NameValue[];
  containersByPort: NameValue[];
  monthlyVolume: { month: string; count: number }[];
  profitTrend: { month: string; profit: number }[];
  top5: ContainerProfitRow[];
  bottom5: ContainerProfitRow[];
  supplierSummary: SupplierSummaryRow[];
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthKey(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export async function getAnalytics(orgId: string): Promise<Analytics> {
  const [containers, pendingDocs, paymentAgg] = await Promise.all([
    prisma.container.findMany({
      where: { orgId },
      select: {
        containerNo: true,
        port: true,
        status: true,
        eta: true,
        createdAt: true,
        supplier: { select: { name: true } },
        sale: { select: { profit: true, saleValue: true, marginPct: true } },
        cost: { select: { beInvoiceValueInr: true } },
      },
    }),
    prisma.document.count({
      where: { orgId, status: { in: ["Pending", "Uploaded"] } },
    }),
    prisma.payment.aggregate({
      where: { orgId, status: { not: "Paid" } },
      _sum: { amountRequested: true, amountPaid: true },
    }),
  ]);

  // --- KPIs ---
  let totalInvoiceValueInr = 0;
  let totalProfit = 0;
  const margins: number[] = [];

  // --- aggregation accumulators ---
  const bySupplier = new Map<
    string,
    { containers: number; profit: number; margins: number[] }
  >();
  const byPort = new Map<string, number>();
  const volumeByMonth = new Map<string, number>();
  const profitByMonth = new Map<string, number>();
  const containerProfits: ContainerProfitRow[] = [];

  for (const c of containers) {
    const profit = num(c.sale?.profit);
    totalProfit += profit;
    totalInvoiceValueInr += num(c.cost?.beInvoiceValueInr);
    if (c.sale?.marginPct != null) margins.push(num(c.sale.marginPct));

    // supplier rollup
    const sup = c.supplier?.name ?? "Unassigned";
    const s = bySupplier.get(sup) ?? { containers: 0, profit: 0, margins: [] };
    s.containers += 1;
    s.profit += profit;
    if (c.sale?.marginPct != null) s.margins.push(num(c.sale.marginPct));
    bySupplier.set(sup, s);

    // port rollup
    const port = c.port ?? "Unknown";
    byPort.set(port, (byPort.get(port) ?? 0) + 1);

    // monthly buckets (by ETA, falling back to createdAt)
    const when = c.eta ?? c.createdAt;
    if (when) {
      const k = monthKey(when);
      volumeByMonth.set(k, (volumeByMonth.get(k) ?? 0) + 1);
      profitByMonth.set(k, (profitByMonth.get(k) ?? 0) + profit);
    }

    if (c.sale?.profit != null) {
      containerProfits.push({
        containerNo: c.containerNo,
        supplier: c.supplier?.name ?? null,
        profit,
        marginPct: c.sale.marginPct != null ? num(c.sale.marginPct) : null,
      });
    }
  }

  const avgMargin =
    margins.length > 0
      ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 100) /
        100
      : null;

  const outstandingUsd = Math.max(
    num(paymentAgg._sum.amountRequested) - num(paymentAgg._sum.amountPaid),
    0
  );

  const sortedByProfit = [...containerProfits].sort(
    (a, b) => b.profit - a.profit
  );

  const supplierSummary: SupplierSummaryRow[] = Array.from(bySupplier.entries())
    .map(([supplier, v]) => ({
      supplier,
      containers: v.containers,
      profit: Math.round(v.profit * 100) / 100,
      avgMargin:
        v.margins.length > 0
          ? Math.round(
              (v.margins.reduce((a, b) => a + b, 0) / v.margins.length) * 100
            ) / 100
          : null,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    kpis: {
      totalContainers: containers.length,
      totalInvoiceValueInr: Math.round(totalInvoiceValueInr * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgMargin,
      pendingDocs,
      outstandingUsd: Math.round(outstandingUsd * 100) / 100,
    },
    profitByContainer: sortedByProfit
      .slice(0, 12)
      .map((c) => ({ name: c.containerNo, value: c.profit })),
    profitBySupplier: supplierSummary
      .filter((s) => s.profit > 0)
      .map((s) => ({ name: s.supplier, value: s.profit })),
    containersByPort: Array.from(byPort.entries()).map(([name, value]) => ({
      name,
      value,
    })),
    monthlyVolume: Array.from(volumeByMonth.entries()).map(([month, count]) => ({
      month,
      count,
    })),
    profitTrend: Array.from(profitByMonth.entries()).map(([month, profit]) => ({
      month,
      profit: Math.round(profit * 100) / 100,
    })),
    top5: sortedByProfit.slice(0, 5),
    bottom5: sortedByProfit.slice(-5).reverse(),
    supplierSummary,
  };
}
