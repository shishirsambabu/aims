import * as XLSX from "xlsx";

import type { ReportData } from "@/lib/data/reports";

function money(v: number): number {
  return Math.round(v * 100) / 100;
}

export function reportToWorkbook(data: ReportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const summary = [
    { Metric: "Containers", Value: data.summary.containers },
    { Metric: "Invoice Value INR", Value: money(data.summary.invoiceValueInr) },
    { Metric: "Total Cost INR", Value: money(data.summary.totalCost) },
    { Metric: "Sale Value INR", Value: money(data.summary.saleValue) },
    { Metric: "Profit INR", Value: money(data.summary.profit) },
    {
      Metric: "Margin %",
      Value:
        data.summary.marginPct == null
          ? ""
          : Math.round(data.summary.marginPct * 100) / 100,
    },
    { Metric: "Outstanding AP", Value: money(data.summary.outstanding) },
  ];

  const suppliers = data.suppliers.map((s) => ({
    Supplier: s.supplier,
    Containers: s.containers,
    "Invoice Value INR": money(s.invoiceValueInr),
    "Total Cost INR": money(s.totalCost),
    "Sale Value INR": money(s.saleValue),
    "Profit INR": money(s.profit),
    "Margin %": s.marginPct == null ? "" : Math.round(s.marginPct * 100) / 100,
  }));

  const ports = data.ports.map((p) => ({
    Port: p.port,
    Containers: p.containers,
    "Sale Value INR": money(p.saleValue),
    "Profit INR": money(p.profit),
  }));

  const aging = data.aging.map((a) => ({
    Bucket: a.label,
    Count: a.count,
    "Outstanding INR": money(a.amount),
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(suppliers),
    "Supplier Performance"
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ports), "Ports");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aging), "AP Aging");

  return wb;
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function reportToCsv(data: ReportData): string {
  const lines: string[] = [];
  lines.push("AIMS Management Report");
  lines.push("");
  lines.push("Summary");
  lines.push("Metric,Value");
  lines.push(`Containers,${data.summary.containers}`);
  lines.push(`Invoice Value INR,${money(data.summary.invoiceValueInr)}`);
  lines.push(`Total Cost INR,${money(data.summary.totalCost)}`);
  lines.push(`Sale Value INR,${money(data.summary.saleValue)}`);
  lines.push(`Profit INR,${money(data.summary.profit)}`);
  lines.push(`Outstanding AP,${money(data.summary.outstanding)}`);
  lines.push("");
  lines.push("Supplier Performance");
  lines.push("Supplier,Containers,Invoice Value INR,Sale Value INR,Profit INR,Margin %");
  for (const s of data.suppliers) {
    lines.push(
      [
        csvCell(s.supplier),
        s.containers,
        money(s.invoiceValueInr),
        money(s.saleValue),
        money(s.profit),
        s.marginPct == null ? "" : Math.round(s.marginPct * 100) / 100,
      ].join(",")
    );
  }
  lines.push("");
  lines.push("AP Aging");
  lines.push("Bucket,Count,Outstanding INR");
  for (const a of data.aging) {
    lines.push([csvCell(a.label), a.count, money(a.amount)].join(","));
  }
  return lines.join("\n");
}

function csvCell(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
