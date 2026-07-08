import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function n(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function money(value: unknown): string {
  return n(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function SalesInvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!can(session.role, "financials.view") && !can(session.role, "invoice.issue")) {
    notFound();
  }

  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      customer: { select: { name: true, gstin: true, billingAddress: true, city: true, state: true, phone: true } },
      salesOrder: { select: { orderNo: true, orderDate: true } },
      lines: { orderBy: { lineNo: "asc" } },
    },
  });
  if (!invoice) notFound();

  return (
    <main className="min-h-screen bg-white p-8 text-slate-950 print:p-0">
      <section className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-8 flex items-start justify-between gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#0070D2]">
              AIMS - Aeden International Management System
            </p>
            <h1 className="mt-3 text-3xl font-black">Tax Invoice</h1>
            <p className="mt-2 text-sm text-slate-600">Aeden Fruits International Pvt Ltd</p>
            <p className="text-sm text-slate-600">Kochi, Kerala, India</p>
            <p className="text-sm text-slate-600">GSTIN: {invoice.supplierGstin ?? "Not configured"}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">Invoice No: {invoice.invoiceNo}</p>
            <p>Date: {invoice.invoiceDate.toISOString().slice(0, 10)}</p>
            <p>Due: {invoice.dueDate?.toISOString().slice(0, 10) ?? "-"}</p>
            <p>Order: {invoice.salesOrder?.orderNo ?? "-"}</p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Bill To</p>
            <h2 className="mt-2 text-lg font-bold">{invoice.customer.name}</h2>
            <p className="text-sm text-slate-600">{invoice.customer.billingAddress ?? "-"}</p>
            <p className="text-sm text-slate-600">
              {[invoice.customer.city, invoice.customer.state].filter(Boolean).join(", ") || "-"}
            </p>
            <p className="text-sm text-slate-600">GSTIN: {invoice.customerGstin ?? invoice.customer.gstin ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">E-Invoice Fields</p>
            <p className="mt-2 text-sm text-slate-600">IRN: {invoice.irn ?? "Pending / Tally"}</p>
            <p className="text-sm text-slate-600">Ack No: {invoice.eInvoiceAckNo ?? "-"}</p>
            <p className="text-sm text-slate-600">Place of Supply: {invoice.placeOfSupply ?? invoice.customer.state ?? "-"}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border border-slate-200 p-2">#</th>
              <th className="border border-slate-200 p-2">Item</th>
              <th className="border border-slate-200 p-2">HSN</th>
              <th className="border border-slate-200 p-2 text-right">Qty</th>
              <th className="border border-slate-200 p-2">UoM</th>
              <th className="border border-slate-200 p-2 text-right">Rate</th>
              <th className="border border-slate-200 p-2 text-right">Taxable</th>
              <th className="border border-slate-200 p-2 text-right">GST</th>
              <th className="border border-slate-200 p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="border border-slate-200 p-2">{line.lineNo}</td>
                <td className="border border-slate-200 p-2">
                  <p className="font-semibold">{line.item}</p>
                  <p className="text-xs text-slate-500">{[line.variety, line.grade].filter(Boolean).join(" / ")}</p>
                </td>
                <td className="border border-slate-200 p-2">{line.hsnCode ?? "0810"}</td>
                <td className="border border-slate-200 p-2 text-right">{money(line.qty)}</td>
                <td className="border border-slate-200 p-2">{line.uom}</td>
                <td className="border border-slate-200 p-2 text-right">{money(line.unitPrice)}</td>
                <td className="border border-slate-200 p-2 text-right">{money(line.taxableAmount)}</td>
                <td className="border border-slate-200 p-2 text-right">{money(line.taxAmount)}</td>
                <td className="border border-slate-200 p-2 text-right">{money(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-end">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 p-4">
            <div className="flex justify-between">
              <span>Taxable value</span>
              <strong>INR {money(invoice.taxableAmount)}</strong>
            </div>
            <div className="mt-2 flex justify-between">
              <span>GST</span>
              <strong>INR {money(invoice.taxAmount)}</strong>
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg">
              <span>Total</span>
              <strong>INR {money(invoice.totalAmount)}</strong>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between text-sm text-slate-500 print:hidden">
          <Link href="/finance" className="font-semibold text-[#0070D2]">
            Back to Finance
          </Link>
          <p>Use the browser print dialog to save this invoice as PDF.</p>
        </div>
      </section>
    </main>
  );
}
