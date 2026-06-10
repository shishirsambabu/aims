import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

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

export function reportToPdfBuffer(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(20)
      .fillColor("#16325C")
      .text("AIMS Management Report", { continued: false });
    doc
      .moveDown(0.3)
      .fontSize(9)
      .fillColor("#667085")
      .text(`Generated ${new Date().toLocaleString("en-IN")}`);

    section(doc, "Executive Summary");
    metric(doc, "Containers", data.summary.containers.toLocaleString("en-IN"));
    metric(doc, "Invoice Value INR", money(data.summary.invoiceValueInr).toLocaleString("en-IN"));
    metric(doc, "Total Cost INR", money(data.summary.totalCost).toLocaleString("en-IN"));
    metric(doc, "Sale Value INR", money(data.summary.saleValue).toLocaleString("en-IN"));
    metric(doc, "Profit INR", money(data.summary.profit).toLocaleString("en-IN"));
    metric(doc, "Outstanding AP", money(data.summary.outstanding).toLocaleString("en-IN"));

    section(doc, "Top Supplier Performance");
    tableHeader(doc, ["Supplier", "Containers", "Profit INR", "Margin %"]);
    for (const s of data.suppliers.slice(0, 12)) {
      tableRow(doc, [
        s.supplier,
        String(s.containers),
        money(s.profit).toLocaleString("en-IN"),
        s.marginPct == null ? "-" : `${s.marginPct.toFixed(1)}%`,
      ]);
    }

    section(doc, "Port Performance");
    tableHeader(doc, ["Port", "Containers", "Profit INR"]);
    for (const p of data.ports.slice(0, 10)) {
      tableRow(doc, [
        p.port,
        String(p.containers),
        money(p.profit).toLocaleString("en-IN"),
      ]);
    }

    section(doc, "AP Aging");
    tableHeader(doc, ["Bucket", "Count", "Outstanding INR"]);
    for (const a of data.aging) {
      tableRow(doc, [
        a.label,
        String(a.count),
        money(a.amount).toLocaleString("en-IN"),
      ]);
    }

    doc
      .moveDown()
      .fontSize(8)
      .fillColor("#667085")
      .text("Generated by AIMS. Figures respect the current user permissions and selected report filters.");
    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(1.1).fontSize(13).fillColor("#101828").text(title);
  doc.moveDown(0.35);
}

function metric(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc
    .fontSize(9)
    .fillColor("#667085")
    .text(label, { continued: true })
    .fillColor("#101828")
    .text(`  ${value}`);
}

function tableHeader(doc: PDFKit.PDFDocument, cells: string[]) {
  doc.fontSize(8).fillColor("#16325C").text(cells.join(" | "));
  doc.moveDown(0.2);
}

function tableRow(doc: PDFKit.PDFDocument, cells: string[]) {
  doc.fontSize(8).fillColor("#101828").text(cells.join(" | "), {
    ellipsis: true,
  });
}
