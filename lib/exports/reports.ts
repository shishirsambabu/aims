import PDFDocument from "pdfkit";

import type { ReportData } from "@/lib/data/reports";
import type { XlsxSheet } from "@/lib/exports/xlsx";

function money(v: number): number {
  return Math.round(v * 100) / 100;
}

export function reportToWorkbook(data: ReportData): XlsxSheet[] {
  const summary = [
    ["Metric", "Value"],
    ["Containers", data.summary.containers],
    ["Invoice Value INR", money(data.summary.invoiceValueInr)],
    ["Total Cost INR", money(data.summary.totalCost)],
    ["Sale Value INR", money(data.summary.saleValue)],
    ["Profit INR", money(data.summary.profit)],
    ["Collections INR", money(data.summary.receiptValue)],
    [
      "Margin %",
        data.summary.marginPct == null
          ? ""
          : Math.round(data.summary.marginPct * 100) / 100,
    ],
    ["Outstanding AP", money(data.summary.outstanding)],
    ["Outstanding AR", money(data.summary.arOutstanding)],
    ["Overdue AR", money(data.summary.arOverdue)],
    ["Receipt Count", data.summary.receiptCount],
  ];

  const suppliers = [
    [
      "Supplier",
      "Containers",
      "Invoice Value INR",
      "Total Cost INR",
      "Sale Value INR",
      "Profit INR",
      "Margin %",
    ],
    ...data.suppliers.map((s) => [
      s.supplier,
      s.containers,
      money(s.invoiceValueInr),
      money(s.totalCost),
      money(s.saleValue),
      money(s.profit),
      s.marginPct == null ? "" : Math.round(s.marginPct * 100) / 100,
    ]),
  ];

  const ports = [
    ["Port", "Containers", "Sale Value INR", "Profit INR"],
    ...data.ports.map((p) => [
      p.port,
      p.containers,
      money(p.saleValue),
      money(p.profit),
    ]),
  ];

  const aging = [
    ["Bucket", "Count", "Outstanding INR"],
    ...data.aging.map((a) => [a.label, a.count, money(a.amount)]),
  ];

  const arAging = [
    ["Bucket", "Count", "Outstanding INR"],
    ...data.receivablesAging.map((a) => [a.label, a.count, money(a.amount)]),
  ];

  const receivables = [
    ["Customer", "Region", "Outstanding INR", "Overdue INR", "Oldest Due"],
    ...data.receivables.map((r) => [
      `${r.customerCode} - ${r.customerName}`,
      r.region ?? "",
      money(r.outstanding),
      money(r.overdue),
      r.oldestDueDate ?? "",
    ]),
  ];

  const receipts = [
    ["Receipt No", "Customer", "Date", "Method", "Currency", "Amount", "Status"],
    ...data.recentReceipts.map((r) => [
      r.receiptNo,
      r.customerName,
      r.receiptDate,
      r.method,
      r.currency,
      money(r.amount),
      r.status,
    ]),
  ];

  return [
    { name: "Summary", rows: summary },
    { name: "Supplier Performance", rows: suppliers },
    { name: "Ports", rows: ports },
    { name: "AP Aging", rows: aging },
    { name: "AR Aging", rows: arAging },
    { name: "Receivables", rows: receivables },
    { name: "Recent Receipts", rows: receipts },
  ];
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
  lines.push(`Collections INR,${money(data.summary.receiptValue)}`);
  lines.push(`Outstanding AP,${money(data.summary.outstanding)}`);
  lines.push(`Outstanding AR,${money(data.summary.arOutstanding)}`);
  lines.push(`Overdue AR,${money(data.summary.arOverdue)}`);
  lines.push(`Receipt Count,${data.summary.receiptCount}`);
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
  lines.push("");
  lines.push("AR Aging");
  lines.push("Bucket,Count,Outstanding INR");
  for (const a of data.receivablesAging) {
    lines.push([csvCell(a.label), a.count, money(a.amount)].join(","));
  }
  lines.push("");
  lines.push("Receivables");
  lines.push("Customer,Region,Outstanding INR,Overdue INR,Oldest Due");
  for (const r of data.receivables) {
    lines.push(
      [
        csvCell(`${r.customerCode} - ${r.customerName}`),
        csvCell(r.region ?? ""),
        money(r.outstanding),
        money(r.overdue),
        r.oldestDueDate ?? "",
      ].join(",")
    );
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
    metric(doc, "Collections INR", money(data.summary.receiptValue).toLocaleString("en-IN"));
    metric(doc, "Outstanding AP", money(data.summary.outstanding).toLocaleString("en-IN"));
    metric(doc, "Outstanding AR", money(data.summary.arOutstanding).toLocaleString("en-IN"));
    metric(doc, "Overdue AR", money(data.summary.arOverdue).toLocaleString("en-IN"));
    metric(doc, "Receipt Count", String(data.summary.receiptCount));

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

    section(doc, "AR Aging");
    tableHeader(doc, ["Bucket", "Count", "Outstanding INR"]);
    for (const a of data.receivablesAging) {
      tableRow(doc, [
        a.label,
        String(a.count),
        money(a.amount).toLocaleString("en-IN"),
      ]);
    }

    section(doc, "Top Receivables");
    tableHeader(doc, ["Customer", "Outstanding INR", "Overdue INR", "Oldest Due"]);
    for (const r of data.receivables.slice(0, 12)) {
      tableRow(doc, [
        `${r.customerCode} - ${r.customerName}`,
        money(r.outstanding).toLocaleString("en-IN"),
        money(r.overdue).toLocaleString("en-IN"),
        r.oldestDueDate ?? "-",
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
