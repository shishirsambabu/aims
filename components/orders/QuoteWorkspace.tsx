"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send, CheckCircle2, XCircle, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/utils";
import type { SalesQuoteRow, SalesQuoteDetail } from "@/lib/data/quotes";
import type { StockItemRow } from "@/lib/data/stock";
import type { PriceListRow } from "@/lib/data/sales";

type Warehouse = { id: string; name: string; code: string; city: string };
type Customer = { id: string; code: string; name: string; tradeName: string | null; approvalStatus: string; kycStatus: string; creditHold: boolean };
type PriceLine = {
  id: string;
  item: string;
  variety: string | null;
  grade: string | null;
  uom: string;
  basePrice: number;
  floorPrice: number;
};

type QuoteLineForm = {
  stockItemId: string;
  item: string;
  variety: string;
  grade: string;
  uom: string;
  qty: string;
  unitPrice: string;
  discountAmount: string;
  notes: string;
};

type QuoteForm = {
  customerId: string;
  warehouseId: string;
  priceListId: string;
  quoteDate: string;
  expiresAt: string;
  notes: string;
  lines: QuoteLineForm[];
};

const emptyLine = (): QuoteLineForm => ({
  stockItemId: "",
  item: "",
  variety: "",
  grade: "",
  uom: "Box",
  qty: "",
  unitPrice: "",
  discountAmount: "",
  notes: "",
});

function toForm(detail?: SalesQuoteDetail | null): QuoteForm {
  return {
    customerId: detail?.customer.id ?? "",
    warehouseId: detail?.warehouse.id ?? "",
    priceListId: detail?.priceList?.id ?? "",
    quoteDate: detail?.quoteDate ?? new Date().toISOString().slice(0, 10),
    expiresAt: detail?.expiresAt ?? "",
    notes: detail?.notes ?? "",
    lines: detail?.lines.length
      ? detail.lines.map((line) => ({
          stockItemId: line.stockItemId ?? "",
          item: line.item,
          variety: line.variety ?? "",
          grade: line.grade ?? "",
          uom: line.uom,
          qty: String(line.qty),
          unitPrice: String(line.unitPrice),
          discountAmount: String(line.discountAmount),
          notes: line.notes ?? "",
        }))
      : [emptyLine()],
  };
}

function priceMatchKey(entry: { item: string; variety: string | null; grade: string | null; uom: string }) {
  return [entry.item.trim().toLowerCase(), (entry.variety ?? "").trim().toLowerCase(), (entry.grade ?? "").trim().toLowerCase(), entry.uom].join("|");
}

export function QuoteWorkspace({
  warehouses,
  customers,
  stockItems,
  priceLists,
  quotes,
  canWrite,
  canApprove,
}: {
  warehouses: Warehouse[];
  customers: Customer[];
  stockItems: StockItemRow[];
  priceLists: PriceListRow[];
  quotes: SalesQuoteRow[];
  canWrite: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quotes[0]?.id ?? null);
  const [detail, setDetail] = useState<SalesQuoteDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceItems, setPriceItems] = useState<PriceLine[]>([]);
  const [form, setForm] = useState<QuoteForm>(() => toForm());
  const [loadingDetail, setLoadingDetail] = useState(false);

  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId) ?? null;
  const stockForWarehouse = useMemo(
    () => stockItems.filter((row) => !form.warehouseId || row.warehouseId === form.warehouseId),
    [form.warehouseId, stockItems]
  );

  useEffect(() => {
    if (!selectedQuoteId) {
      return;
    }
    let ignore = false;
    async function load() {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/quotes/${selectedQuoteId}`);
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Failed to load quote");
          return;
        }
        if (!ignore) {
          setDetail(json.data as SalesQuoteDetail);
          setForm(toForm(json.data as SalesQuoteDetail));
        }
      } catch {
        toast.error("Network error");
      } finally {
        if (!ignore) setLoadingDetail(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [selectedQuoteId]);

  useEffect(() => {
    let ignore = false;
    async function loadPriceListItems() {
      if (!form.priceListId) {
        setPriceItems([]);
        return;
      }
      try {
        const res = await fetch(`/api/price-lists/${form.priceListId}`);
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Failed to load price list");
          return;
        }
        if (!ignore) {
          setPriceItems(Array.isArray(json.data?.items) ? json.data.items : []);
        }
      } catch {
        toast.error("Network error");
      }
    }
    loadPriceListItems();
    return () => {
      ignore = true;
    };
  }, [form.priceListId]);

  function setLine(index: number, patch: Partial<QuoteLineForm>) {
    setForm((current) => {
      const lines = [...current.lines];
      lines[index] = { ...lines[index], ...patch };
      return { ...current, lines };
    });
  }

  function addLine() {
    setForm((current) => ({ ...current, lines: [...current.lines, emptyLine()] }));
  }

  function removeLine(index: number) {
    setForm((current) => ({ ...current, lines: current.lines.length === 1 ? current.lines : current.lines.filter((_, i) => i !== index) }));
  }

  function applyStockDefaults(index: number, stockItemId: string) {
    const stock = stockItems.find((row) => row.id === stockItemId);
    const price = stock
      ? priceItems.find((item) => priceMatchKey(item) === priceMatchKey({ item: stock.item, variety: stock.variety, grade: stock.grade, uom: stock.uom }))
      : null;
    setLine(index, {
      stockItemId,
      item: stock?.item ?? "",
      variety: stock?.variety ?? "",
      grade: stock?.grade ?? "",
      uom: stock?.uom ?? "Box",
      unitPrice: price ? String(price.basePrice) : "",
    });
  }

  async function saveQuote(action: "create" | "amend" | "submit" | "approve" | "reject") {
    if (!canWrite && action === "create") {
      toast.error("You do not have permission to create quotes");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        customerId: form.customerId,
        warehouseId: form.warehouseId,
        priceListId: form.priceListId || undefined,
        quoteDate: form.quoteDate,
        expiresAt: form.expiresAt || undefined,
        notes: form.notes || undefined,
        lines: form.lines
          .filter((line) => line.item.trim() && line.qty && line.unitPrice)
          .map((line) => ({
            stockItemId: line.stockItemId || undefined,
            item: line.item,
            variety: line.variety || undefined,
            grade: line.grade || undefined,
            uom: line.uom,
            qty: line.qty,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount || undefined,
            notes: line.notes || undefined,
          })),
      };

      if (action === "create") {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Failed to create quote");
          return;
        }
        toast.success("Quote created");
        setSelectedQuoteId(json.data.id);
        router.refresh();
        return;
      }

      if (!selectedQuoteId) {
        toast.error("Select a quote first");
        return;
      }

      const res = await fetch(`/api/quotes/${selectedQuoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "amend" ? "amend" : action,
          notes: form.notes || undefined,
          lines: action === "amend" ? payload.lines : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update quote");
        return;
      }
      toast.success("Quote updated");
      setDetail(json.data);
      setForm(toForm(json.data));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function convertQuote() {
    if (!selectedQuoteId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${selectedQuoteId}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to convert quote");
        return;
      }
      toast.success("Quote converted into a sales order");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reviewQuote(action: "submit" | "approve" | "reject") {
    if (!selectedQuoteId) return;
    const reason = action === "reject" ? window.prompt("Rejection reason") ?? "" : "";
    if (action === "reject" && !reason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${selectedQuoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to review quote");
        return;
      }
      toast.success(action === "approve" ? "Quote approved" : action === "reject" ? "Quote rejected" : "Quote submitted");
      setDetail(json.data);
      setForm(toForm(json.data));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-caps">Quote Register</p>
              <h3 className="font-heading text-lg font-semibold">Drafts, approvals, and conversions</h3>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedQuoteId(null);
                setDetail(null);
                setForm(toForm());
              }}
            >
              <Plus className="h-4 w-4" /> New quote
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {quotes.map((quote) => (
              <button
                key={quote.id}
                onClick={() => setSelectedQuoteId(quote.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedQuoteId === quote.id ? "border-primary bg-primary/5" : "border-border bg-background"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{quote.quoteNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {quote.customerName} · {quote.warehouseName}
                    </p>
                  </div>
                  <Badge variant="outline">{quote.approvalStatus}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{quote.quoteDate}</span>
                  <span className="font-financial">{formatINR(quote.netAmount ?? 0)}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-caps">{selectedQuote ? selectedQuote.quoteNo : "New Quote"}</p>
              <h3 className="font-heading text-lg font-semibold">
                {selectedQuote ? "Amend and convert" : "Create draft quote"}
              </h3>
            </div>
            {loadingDetail ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Customer">
              <Select value={form.customerId} onValueChange={(value) => setForm((current) => ({ ...current, customerId: value }))}>
                <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Warehouse">
              <Select value={form.warehouseId} onValueChange={(value) => setForm((current) => ({ ...current, warehouseId: value }))}>
                <SelectTrigger><SelectValue placeholder="Choose warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Price list">
              <Select value={form.priceListId || "__none__"} onValueChange={(value) => setForm((current) => ({ ...current, priceListId: value === "__none__" ? "" : value }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No linked price list</SelectItem>
                  {priceLists.filter((pl) => pl.warehouseId === form.warehouseId).map((priceList) => (
                    <SelectItem key={priceList.id} value={priceList.id}>
                      {priceList.priceDate} · {priceList.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quote date">
              <Input value={form.quoteDate} type="date" onChange={(e) => setForm((current) => ({ ...current, quoteDate: e.target.value }))} />
            </Field>
            <Field label="Expires at">
              <Input value={form.expiresAt} type="date" onChange={(e) => setForm((current) => ({ ...current, expiresAt: e.target.value }))} />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} rows={3} />
            </Field>
          </div>

          <div className="mt-4 space-y-3">
            {form.lines.map((line, index) => {
              const stockMatch = stockForWarehouse.find((row) => row.id === line.stockItemId);
              return (
                <div key={`${index}-${line.stockItemId}`} className="rounded-xl border border-border p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Stock lot">
                      <Select value={line.stockItemId} onValueChange={(value) => applyStockDefaults(index, value)}>
                        <SelectTrigger><SelectValue placeholder="Choose stock lot" /></SelectTrigger>
                        <SelectContent>
                          {stockForWarehouse.map((stock) => (
                            <SelectItem key={stock.id} value={stock.id}>
                              {stock.containerNo} · {stock.item} {stock.grade ? `· ${stock.grade}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Item">
                      <Input value={line.item} onChange={(e) => setLine(index, { item: e.target.value })} />
                    </Field>
                    <Field label="Qty">
                      <Input value={line.qty} onChange={(e) => setLine(index, { qty: e.target.value })} />
                    </Field>
                    <Field label="UoM">
                      <Input value={line.uom} onChange={(e) => setLine(index, { uom: e.target.value })} />
                    </Field>
                    <Field label="Unit price">
                      <Input value={line.unitPrice} onChange={(e) => setLine(index, { unitPrice: e.target.value })} />
                    </Field>
                    <Field label="Discount">
                      <Input value={line.discountAmount} onChange={(e) => setLine(index, { discountAmount: e.target.value })} />
                    </Field>
                    <Field label="Variety">
                      <Input value={line.variety} onChange={(e) => setLine(index, { variety: e.target.value })} />
                    </Field>
                    <Field label="Grade">
                      <Input value={line.grade} onChange={(e) => setLine(index, { grade: e.target.value })} />
                    </Field>
                    <Field label="Notes">
                      <Input value={line.notes} onChange={(e) => setLine(index, { notes: e.target.value })} />
                    </Field>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {stockMatch ? `${stockMatch.containerNo} · ${stockMatch.grade ?? "No grade"} · ${stockMatch.qtyAvailable} available` : "No stock selected"}
                    </span>
                    <span className="font-financial">
                      {Number(line.qty || 0) && Number(line.unitPrice || 0)
                        ? formatINR(Math.max(0, Number(line.qty) * Number(line.unitPrice) - Number(line.discountAmount || 0)))
                        : "0"}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => removeLine(index)}>
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4" /> Add line
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => saveQuote(selectedQuoteId ? "amend" : "create")} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {selectedQuoteId ? "Save amendment" : "Save draft"}
            </Button>
            {selectedQuoteId ? (
              <>
                <Button variant="outline" onClick={() => reviewQuote("submit")} disabled={busy}>
                  <Send className="h-4 w-4" /> Submit
                </Button>
                <Button variant="outline" onClick={() => reviewQuote("approve")} disabled={busy || !canApprove}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" onClick={() => reviewQuote("reject")} disabled={busy || !canApprove}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button variant="outline" onClick={convertQuote} disabled={busy}>
                  <ArrowRightLeft className="h-4 w-4" /> Convert to order
                </Button>
              </>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold">Revision history</h4>
                <div className="mt-3 space-y-2">
                  {detail?.revisions?.length ? detail.revisions.map((revision) => (
                    <div key={revision.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Revision {revision.revisionNo}</span>
                        <Badge variant="outline">{revision.changeType}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{revision.note ?? "No note"} · {revision.createdAt}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No revisions yet.</p>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold">Current snapshot</h4>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>Status: <span className="text-foreground">{detail?.approvalStatus ?? selectedQuote?.approvalStatus ?? "Draft"}</span></p>
                  <p>Net value: <span className="font-financial text-foreground">{formatINR(detail?.netAmount ?? selectedQuote?.netAmount ?? 0)}</span></p>
                  <p>Lines: <span className="text-foreground">{detail?.lines.length ?? selectedQuote?.lineCount ?? 0}</span></p>
                  <p>Converted: <span className="text-foreground">{detail?.convertedAt ?? "Not yet"}</span></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
