"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, RotateCcw, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FinanceDocumentWorkspaceData, InvoiceReadyOrderRow } from "@/lib/data/finance-documents";
import { cn, formatDate, formatINR, formatMoney } from "@/lib/utils";

type ReturnDisposition = "Restock" | "QualityHold" | "Dump" | "Reject";

export function FinanceDocumentsWorkspace({
  data,
  canIssueInvoice,
  canIssueCreditNote,
  canPostReturn,
}: {
  data: FinanceDocumentWorkspaceData;
  canIssueInvoice: boolean;
  canIssueCreditNote: boolean;
  canPostReturn: boolean;
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [taxRatePct, setTaxRatePct] = useState("0");
  const [returnOrderId, setReturnOrderId] = useState(data.returnReadyOrders[0]?.id ?? "");
  const [returnLineId, setReturnLineId] = useState(data.returnReadyOrders[0]?.lines[0]?.id ?? "");
  const [returnQty, setReturnQty] = useState("");
  const [returnDisposition, setReturnDisposition] = useState<ReturnDisposition>("QualityHold");
  const [returnCreditAmount, setReturnCreditAmount] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const selectedReturnOrder = data.returnReadyOrders.find((order) => order.id === returnOrderId) ?? null;

  async function issueInvoice(order: InvoiceReadyOrderRow) {
    setBusyKey(`invoice:${order.id}`);
    try {
      const res = await fetch("/api/sales-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderId: order.id,
          taxRatePct: Number(taxRatePct) || 0,
          dueDate: order.dueDate ?? undefined,
          notes: "Issued from finance control desk",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not issue invoice");
        return;
      }
      toast.success(`Invoice issued for ${order.orderNo}`);
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function issueCreditNote(invoiceId: string, remainingAmount: number) {
    const amountText = window.prompt("Credit amount", remainingAmount.toFixed(2));
    if (!amountText) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid credit amount");
      return;
    }
    const reason = window.prompt("Credit note reason");
    if (!reason?.trim()) return;

    setBusyKey(`credit:${invoiceId}`);
    try {
      const res = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesInvoiceId: invoiceId, amount, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not issue credit note");
        return;
      }
      toast.success("Credit note issued");
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function cancelDocument(kind: "sales-invoices" | "credit-notes" | "sales-returns", id: string) {
    const reason = window.prompt("Cancellation reason");
    if (!reason?.trim()) return;
    setBusyKey(`cancel:${kind}:${id}`);
    try {
      const res = await fetch(`/api/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not cancel document");
        return;
      }
      toast.success("Document cancelled");
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function postReturn() {
    if (!selectedReturnOrder || !returnLineId || !returnQty || !returnReason.trim()) {
      toast.error("Select order, line, quantity, and reason");
      return;
    }
    setBusyKey("return");
    try {
      const res = await fetch("/api/sales-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderId: selectedReturnOrder.id,
          reason: returnReason,
          lines: [
            {
              salesOrderLineId: returnLineId,
              qty: Number(returnQty),
              disposition: returnDisposition,
              creditAmount: returnCreditAmount ? Number(returnCreditAmount) : undefined,
              reason: returnReason,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not post return");
        return;
      }
      toast.success("Return posted");
      setReturnQty("");
      setReturnCreditAmount("");
      setReturnReason("");
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Issued invoices" value={formatINR(data.summary.invoiceValue)} icon={FileText} />
        <Metric label="Credit notes" value={formatINR(data.summary.creditValue)} icon={WalletCards} />
        <Metric label="Return credits" value={formatINR(data.summary.returnValue)} icon={RotateCcw} />
        <Metric label="Open invoice count" value={data.summary.openInvoiceCount.toString()} icon={ShieldCheck} />
      </div>

      <Card className="rounded-[1.35rem]">
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="label-caps">Invoice control</p>
              <h3 className="font-heading text-lg font-semibold">Dispatches ready for invoice</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Only approved orders that have entered fulfilment can be invoiced.
              </p>
            </div>
            <div className="w-full md:w-40">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Tax %
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRatePct}
                onChange={(event) => setTaxRatePct(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoiceReadyOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={FileText}
                        title="No dispatches waiting for invoice"
                        description="As orders move into dispatch, finance can issue invoices from here."
                        className="border-0 bg-transparent py-8"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  data.invoiceReadyOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium">{order.orderNo}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.customerName} - {formatDate(order.orderDate)}
                        </div>
                      </TableCell>
                      <TableCell>{order.warehouseName}</TableCell>
                      <TableCell><Badge>{order.status}</Badge></TableCell>
                      <TableCell className="font-financial text-right">{formatINR(order.netAmount)}</TableCell>
                      <TableCell className="text-right">
                        {canIssueInvoice ? (
                          <Button
                            size="sm"
                            onClick={() => void issueInvoice(order)}
                            disabled={busyKey === `invoice:${order.id}`}
                          >
                            Issue invoice
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.35rem]">
          <CardContent className="p-6">
            <div className="mb-4">
              <p className="label-caps">Issued invoices</p>
              <h3 className="font-heading text-lg font-semibold">Invoice and credit control</h3>
            </div>
            <div className="space-y-3">
              {data.invoices.length === 0 ? (
                <EmptyState icon={FileText} title="No invoices yet" description="Issue invoices from dispatched orders." />
              ) : (
                data.invoices.map((invoice) => {
                  const remaining = Math.max(invoice.totalAmount - invoice.creditedAmount, 0);
                  return (
                    <div key={invoice.id} className="rounded-2xl border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-heading font-semibold">{invoice.invoiceNo}</p>
                            <StatusBadge status={invoice.status} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {invoice.customerName} - {invoice.salesOrderNo ?? "No order"} - {formatDate(invoice.invoiceDate)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Taxable {formatMoney(invoice.taxableAmount, invoice.currency)} - Tax {formatMoney(invoice.taxAmount, invoice.currency)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-financial text-lg font-semibold">{formatMoney(invoice.totalAmount, invoice.currency)}</p>
                          <p className="text-xs text-muted-foreground">
                            Remaining {formatMoney(remaining, invoice.currency)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canIssueCreditNote && invoice.status !== "Cancelled" && remaining > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void issueCreditNote(invoice.id, remaining)}
                            disabled={busyKey === `credit:${invoice.id}`}
                          >
                            Issue credit note
                          </Button>
                        ) : null}
                        {canIssueInvoice && invoice.status !== "Cancelled" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void cancelDocument("sales-invoices", invoice.id)}
                            disabled={busyKey === `cancel:sales-invoices:${invoice.id}`}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.35rem]">
          <CardContent className="p-6">
            <div className="mb-4">
              <p className="label-caps">Returns desk</p>
              <h3 className="font-heading text-lg font-semibold">Customer return posting</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Restock only when the fruit is physically accepted back into sellable stock.
              </p>
            </div>
            {canPostReturn ? (
              <div className="grid gap-3">
                <Select
                  value={returnOrderId}
                  onValueChange={(value) => {
                    setReturnOrderId(value);
                    const order = data.returnReadyOrders.find((row) => row.id === value);
                    setReturnLineId(order?.lines[0]?.id ?? "");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select dispatched order" /></SelectTrigger>
                  <SelectContent>
                    {data.returnReadyOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.orderNo} - {order.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={returnLineId} onValueChange={setReturnLineId} disabled={!selectedReturnOrder}>
                  <SelectTrigger><SelectValue placeholder="Select order line" /></SelectTrigger>
                  <SelectContent>
                    {selectedReturnOrder?.lines.map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        {line.item} {line.grade ?? ""} - {line.qty} {line.uom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Return qty" type="number" min="0" step="0.001" value={returnQty} onChange={(event) => setReturnQty(event.target.value)} />
                  <Select value={returnDisposition} onValueChange={(value) => setReturnDisposition(value as ReturnDisposition)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QualityHold">Quality hold</SelectItem>
                      <SelectItem value="Restock">Restock</SelectItem>
                      <SelectItem value="Dump">Dump</SelectItem>
                      <SelectItem value="Reject">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="Credit amount, if finance approves" type="number" min="0" step="0.01" value={returnCreditAmount} onChange={(event) => setReturnCreditAmount(event.target.value)} />
                <Input placeholder="Return reason" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} />
                <Button onClick={() => void postReturn()} disabled={busyKey === "return"}>
                  Post return
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                You can view returns, but posting is restricted to finance/admin roles.
              </div>
            )}

            <div className="mt-6 space-y-3">
              {data.returns.length === 0 ? (
                <EmptyState icon={RotateCcw} title="No returns posted" description="Customer returns will appear here with reason and value." />
              ) : (
                data.returns.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{row.returnNo}</p>
                        <p className="text-sm text-muted-foreground">
                          {row.customerName} - {row.salesOrderNo ?? "No order"} - {row.warehouseName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={row.status} />
                        <p className="mt-2 font-financial text-sm">{formatINR(row.creditAmount)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.35rem]">
        <CardContent className="p-6">
          <div className="mb-4">
            <p className="label-caps">Credit trail</p>
            <h3 className="font-heading text-lg font-semibold">Issued credit notes</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.creditNotes.length === 0 ? (
              <EmptyState icon={WalletCards} title="No credit notes" description="Credits issued against invoices or orders appear here." />
            ) : (
              data.creditNotes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{note.creditNoteNo}</p>
                        <StatusBadge status={note.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {note.customerName} - {note.salesInvoiceNo ?? note.salesOrderNo ?? "Standalone"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{note.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-financial font-semibold">{formatMoney(note.amount, note.currency)}</p>
                      {canIssueCreditNote && note.status !== "Cancelled" ? (
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="ghost"
                          onClick={() => void cancelDocument("credit-notes", note.id)}
                          disabled={busyKey === `cancel:credit-notes:${note.id}`}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
}) {
  return (
    <Card className="border-t-4 border-t-primary">
      <CardContent className="flex items-center justify-between gap-4 pt-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-financial mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={status === "Cancelled" ? "danger" : status === "Draft" ? "warning" : "success"}
      className={cn(status === "Issued" && "bg-success/10")}
    >
      {status}
    </Badge>
  );
}
