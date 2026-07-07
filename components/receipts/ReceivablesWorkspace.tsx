"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDate, formatINR, formatMoney } from "@/lib/utils";
import type {
  AgingBucket,
  CustomerLedger,
  CustomerReceiptRow,
  ReceivableCustomerRow,
} from "@/lib/data/receivables";

type ReceiptMethod = "Cash" | "BankTransfer" | "UPI" | "Cheque" | "Card" | "Adjustment";
type ReceiptCurrency = "USD" | "AED" | "INR";

type AllocationFormRow = {
  salesOrderId: string;
  amount: string;
  notes: string;
};

type ReceiptFormState = {
  customerId: string;
  receiptDate: string;
  method: ReceiptMethod;
  currency: ReceiptCurrency;
  referenceNo: string;
  bankName: string;
  notes: string;
  allocations: AllocationFormRow[];
};
type CancelReceiptDialogState = {
  open: boolean;
  receiptId: string;
  receiptNo: string;
  reason: string;
};

const METHOD_OPTIONS: ReceiptMethod[] = [
  "BankTransfer",
  "Cash",
  "UPI",
  "Cheque",
  "Card",
  "Adjustment",
];

const CURRENCY_OPTIONS: ReceiptCurrency[] = ["INR", "USD", "AED"];

function emptyReceiptForm(customerId = ""): ReceiptFormState {
  return {
    customerId,
    receiptDate: new Date().toISOString().slice(0, 10),
    method: "BankTransfer",
    currency: "INR",
    referenceNo: "",
    bankName: "",
    notes: "",
    allocations: [{ salesOrderId: "", amount: "", notes: "" }],
  };
}

function formFromLedger(ledger: CustomerLedger): ReceiptFormState {
  const openOrders = [...ledger.orders.filter((order) => order.outstanding > 0)].sort(
    (a, b) =>
      new Date(a.dueDate ?? a.orderDate).getTime() - new Date(b.dueDate ?? b.orderDate).getTime()
  );
  const allocations =
    openOrders.length > 0
      ? openOrders.map((order) => ({
          salesOrderId: order.id,
          amount: order.outstanding.toFixed(2),
          notes: "",
        }))
      : [{ salesOrderId: "", amount: "", notes: "" }];
  return {
    customerId: ledger.customer.id,
    receiptDate: new Date().toISOString().slice(0, 10),
    method: "BankTransfer",
    currency: "INR",
    referenceNo: "",
    bankName: "",
    notes: "",
    allocations,
  };
}

function formatReference(value: string | null | undefined) {
  return value?.trim() ? value : "-";
}

export function ReceivablesWorkspace({
  customers,
  receipts,
  canRecord,
  canViewFinancials,
}: {
  customers: ReceivableCustomerRow[];
  receipts: CustomerReceiptRow[];
  canRecord: boolean;
  canViewFinancials: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customers[0]?.id ?? null);
  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<CancelReceiptDialogState>({
    open: false,
    receiptId: "",
    receiptNo: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ReceiptFormState>(emptyReceiptForm(customers[0]?.id ?? ""));

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((row) =>
      [row.code, row.name, row.tradeName, row.region, row.kycStatus, row.approvalStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [customers, query]);

  const activeCustomerId =
    (selectedCustomerId && customers.some((row) => row.id === selectedCustomerId)
      ? selectedCustomerId
      : customers[0]?.id) ?? null;

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.id === activeCustomerId) ?? null,
    [customers, activeCustomerId]
  );

  const openOrders = ledger?.orders.filter((order) => order.outstanding > 0) ?? [];
  const receiptTotal = form.allocations.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  useEffect(() => {
    if (!activeCustomerId) return;
    let ignore = false;

    async function load() {
      setLedgerBusy(true);
      try {
        const res = await fetch(`/api/customer-receipts?customerId=${encodeURIComponent(activeCustomerId)}`);
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Failed to load customer ledger");
          return;
        }
        if (!ignore) {
          setLedger(json.data as CustomerLedger);
          setForm((current) => (current.customerId === activeCustomerId ? current : formFromLedger(json.data as CustomerLedger)));
        }
      } catch {
        toast.error("Network error");
      } finally {
        if (!ignore) setLedgerBusy(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [activeCustomerId]);

  function refreshLedger() {
    router.refresh();
  }

  function populateOldestBalances() {
    if (!ledger) return;
    setForm(formFromLedger(ledger));
  }

  function openReceiptDialog() {
    if (!ledger) {
      toast.error("Select a customer first");
      return;
    }
    setForm(formFromLedger(ledger));
    setReceiptDialogOpen(true);
  }

  function setAllocation(index: number, patch: Partial<AllocationFormRow>) {
    setForm((current) => {
      const allocations = [...current.allocations];
      allocations[index] = { ...allocations[index], ...patch };
      return { ...current, allocations };
    });
  }

  function addAllocationRow() {
    setForm((current) => ({
      ...current,
      allocations: [...current.allocations, { salesOrderId: "", amount: "", notes: "" }],
    }));
  }

  async function submitReceipt() {
    if (!ledger) {
      toast.error("Select a customer first");
      return;
    }
    const payload = {
      customerId: ledger.customer.id,
      receiptDate: form.receiptDate,
      method: form.method,
      currency: form.currency,
      amount: receiptTotal,
      referenceNo: form.referenceNo || undefined,
      bankName: form.bankName || undefined,
      notes: form.notes || undefined,
      allocations: form.allocations
        .filter((row) => row.salesOrderId && Number(row.amount) > 0)
        .map((row) => ({
          salesOrderId: row.salesOrderId,
          amount: Number(row.amount),
          notes: row.notes || undefined,
        })),
    };

    if (payload.allocations.length === 0) {
      toast.error("Add at least one allocation");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/customer-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to record receipt");
        return;
      }
      toast.success("Receipt recorded");
      setReceiptDialogOpen(false);
      router.refresh();
      if (selectedCustomerId) {
        const res2 = await fetch(`/api/customer-receipts?customerId=${encodeURIComponent(selectedCustomerId)}`);
        const json2 = await res2.json();
        if (res2.ok) setLedger(json2.data as CustomerLedger);
      }
    } finally {
      setSaving(false);
    }
  }

  function openCancelDialog(receipt: CustomerReceiptRow) {
    setCancelDialog({
      open: true,
      receiptId: receipt.id,
      receiptNo: receipt.receiptNo,
      reason: "",
    });
  }

  async function submitCancelReceipt() {
    const reason = cancelDialog.reason.trim();
    if (reason.length < 3) {
      toast.error("A receipt cancellation reason is required");
      return;
    }
    const res = await fetch(`/api/customer-receipts/${cancelDialog.receiptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to cancel receipt");
      return;
    }
    toast.success("Receipt cancelled");
    setCancelDialog((current) => ({ ...current, open: false }));
    router.refresh();
    if (selectedCustomerId) {
      const res2 = await fetch(`/api/customer-receipts?customerId=${encodeURIComponent(selectedCustomerId)}`);
      const json2 = await res2.json();
      if (res2.ok) setLedger(json2.data as CustomerLedger);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Customers" value={customers.length.toString()} />
        <Metric label="Outstanding" value={formatINR(customers.reduce((sum, row) => sum + row.outstanding, 0))} />
        <Metric label="Overdue" value={formatINR(customers.reduce((sum, row) => sum + row.overdue, 0))} />
        <Metric label="Receipts" value={receipts.length.toString()} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, region, KYC, status..."
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex gap-2">
          {canRecord && (
            <Button onClick={openReceiptDialog} disabled={!ledger}>
              <Plus className="h-4 w-4" /> Record Receipt
            </Button>
          )}
          <Button variant="outline" onClick={refreshLedger}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold">Receivable Customers</h3>
              <div className="text-sm text-muted-foreground">
                {canViewFinancials ? "Financial view enabled" : "Operational view"}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Customer</TableHead>
                    <TableHead>KYC</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Receipts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-44 text-center text-muted-foreground">
                        <EmptyState
                          icon={ShieldAlert}
                          title="No receivables yet"
                          description="Customer collections will appear here once orders are approved."
                          className="border-0 bg-transparent py-6"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(row.id === selectedCustomerId && "bg-primary/5")}
                        onClick={() => setSelectedCustomerId(row.id)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{row.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.code}
                              {row.tradeName ? ` - ${row.tradeName}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.region ?? "No region"} - {row.oldestDueDate ? `Oldest due ${formatDate(row.oldestDueDate)}` : "No overdue due date"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge
                              variant={
                                row.kycStatus === "Approved"
                                  ? "success"
                                  : row.kycStatus === "Rejected"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {row.kycStatus}
                            </Badge>
                            <div className="text-xs text-muted-foreground">{row.approvalStatus}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-financial text-right">{formatINR(row.outstanding)}</TableCell>
                        <TableCell
                          className={cn(
                            "font-financial text-right",
                            row.overdue > 0 ? "text-danger" : "text-muted-foreground"
                          )}
                        >
                          {formatINR(row.overdue)}
                        </TableCell>
                        <TableCell className="font-financial text-right">{row.orderCount}</TableCell>
                        <TableCell className="font-financial text-right">{row.receiptCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {ledgerBusy ? (
              <div className="flex min-h-[520px] items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : ledger ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="label-caps">Customer Ledger</p>
                    <h3 className="font-heading text-xl font-semibold">{ledger.customer.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {ledger.customer.code}
                      {ledger.customer.tradeName ? ` - ${ledger.customer.tradeName}` : ""}
                    </p>
                  </div>
                  {canRecord && (
                    <Button onClick={openReceiptDialog}>
                      <Plus className="h-4 w-4" /> Record
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Meta label="Outstanding" value={formatINR(ledger.summary.outstanding)} />
                  <Meta label="Overdue" value={formatINR(ledger.summary.overdue)} />
                  <Meta label="Receipts" value={formatINR(ledger.summary.receiptValue)} />
                  <Meta label="Open Orders" value={ledger.orders.filter((order) => order.outstanding > 0).length.toString()} />
                </div>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading text-base font-semibold">Aging Breakdown</h4>
                    <span className="text-xs text-muted-foreground">Outstanding by due date</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {ledger.summary.agingBuckets.map((bucket) => (
                      <AgingCard key={bucket.label} bucket={bucket} />
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading text-base font-semibold">Open Orders</h4>
                    <span className="text-xs text-muted-foreground">
                      {openOrders.length} open
                    </span>
                  </div>
                  <div className="space-y-2">
                    {openOrders.length === 0 ? (
                      <EmptyState
                        icon={AlertTriangle}
                        title="No open orders"
                        description="All approved orders for this customer are fully collected."
                        className="border-0 bg-transparent py-6"
                      />
                    ) : (
                      openOrders.map((order) => (
                        <div key={order.id} className="rounded-xl border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">
                                {order.orderNo} - {formatDate(order.orderDate)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Due {formatDate(order.dueDate)} - {order.status} - {order.approvalStatus}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="font-financial">{formatINR(order.outstanding)}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatINR(order.receivedAmount)} received
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading text-base font-semibold">Recent Receipts</h4>
                    <span className="text-xs text-muted-foreground">{ledger.receipts.length} posted</span>
                  </div>
                  <div className="space-y-2">
                    {ledger.receipts.length === 0 ? (
                      <EmptyState
                        icon={ShieldAlert}
                        title="No receipts yet"
                        description="Record a customer collection to start the ledger trail."
                        className="border-0 bg-transparent py-6"
                      />
                    ) : (
                      ledger.receipts.map((receipt) => (
                        <div key={receipt.id} className="rounded-xl border border-border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {receipt.receiptNo} - {formatDate(receipt.receiptDate)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {receipt.method} - {formatReference(receipt.referenceNo)} - {formatReference(receipt.bankName)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Allocations {receipt.allocationCount} - Notes {formatReference(receipt.notes)}
                              </p>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="text-right">
                                <p className="font-financial">{formatMoney(receipt.amount, receipt.currency)}</p>
                                <p className="text-xs text-muted-foreground">
                                  Allocated {formatMoney(receipt.allocationsTotal, receipt.currency)}
                                </p>
                              </div>
                              {canRecord && receipt.status === "Posted" && (
                                <button
                                  onClick={() => openCancelDialog(receipt)}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger"
                                  title="Cancel receipt"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <EmptyState
                icon={ShieldAlert}
                title="Select a customer"
                description="Open a customer row to inspect open orders, receipts, and collection status."
                className="border-0 bg-transparent py-10"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Customer Receipt</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer">
              <Input value={ledger?.customer.name ?? selectedCustomer?.name ?? ""} disabled />
            </Field>
            <Field label="Receipt Date">
              <Input
                type="date"
                value={form.receiptDate}
                onChange={(e) => setForm({ ...form, receiptDate: e.target.value })}
              />
            </Field>
            <Field label="Method">
              <Select value={form.method} onValueChange={(value) => setForm({ ...form, method: value as ReceiptMethod })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Currency">
              <Select value={form.currency} onValueChange={(value) => setForm({ ...form, currency: value as ReceiptCurrency })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference No">
              <Input
                value={form.referenceNo}
                onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                placeholder="UTR / cheque / transaction id"
              />
            </Field>
            <Field label="Bank Name">
              <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </Field>
            <Field label="Receipt Total">
              <Input value={formatMoney(receiptTotal, form.currency)} disabled />
            </Field>
            <Field label="Notes">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading text-base font-semibold">Allocations</h4>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={populateOldestBalances}>
                  Allocate oldest first
                </Button>
                <Button variant="outline" size="sm" onClick={addAllocationRow}>
                  <Plus className="h-4 w-4" /> Add row
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {form.allocations.map((row, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-3">
                  <Select
                    value={row.salesOrderId}
                    onValueChange={(value) => setAllocation(index, { salesOrderId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sales order" />
                    </SelectTrigger>
                    <SelectContent>
                      {openOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.orderNo} - {formatINR(order.outstanding)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={row.amount}
                    onChange={(e) => setAllocation(index, { amount: e.target.value })}
                  />
                  <Input
                    placeholder="Notes"
                    value={row.notes}
                    onChange={(e) => setAllocation(index, { notes: e.target.value })}
                  />
                  <div className="flex items-center justify-end md:col-span-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          allocations:
                            current.allocations.length === 1
                              ? [{ salesOrderId: "", amount: "", notes: "" }]
                              : current.allocations.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitReceipt} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelDialog.open}
        onOpenChange={(open) => setCancelDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel receipt</DialogTitle>
            <DialogDescription>
              {cancelDialog.receiptNo
                ? `${cancelDialog.receiptNo} will be reversed from the customer ledger with this reason.`
                : "Record why this receipt is being cancelled."}
            </DialogDescription>
          </DialogHeader>
          <Field label="Cancellation reason">
            <Input
              value={cancelDialog.reason}
              onChange={(event) =>
                setCancelDialog((current) => ({ ...current, reason: event.target.value }))
              }
              placeholder="Duplicate entry, wrong customer allocation, bank mismatch..."
            />
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialog((current) => ({ ...current, open: false }))}
              disabled={saving}
            >
              Keep receipt
            </Button>
            <Button variant="destructive" onClick={submitCancelReceipt} disabled={saving}>
              Cancel receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-t-4 border-t-primary">
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-financial mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value ?? "-"}</p>
    </div>
  );
}

function AgingCard({ bucket }: { bucket: AgingBucket }) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{bucket.label}</p>
      <p className="mt-2 text-lg font-semibold">{bucket.count}</p>
      <p className="font-financial text-sm text-muted-foreground">{formatINR(bucket.amount)}</p>
    </div>
  );
}
