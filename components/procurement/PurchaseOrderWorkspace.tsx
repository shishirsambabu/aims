"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatMoney } from "@/lib/utils";

export interface PoRow {
  id: string;
  poNo: string;
  poDate: string;
  status: string;
  currency: "USD" | "AED" | "INR";
  supplierName: string;
  containerNo: string | null;
  estimatedGoodsValue: number;
  estimatedTotal: number;
  actualLandedCost: number | null;
  varianceAmount: number | null;
  advancePaidAmount: number | null;
  lineCount: number;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ContainerOption {
  id: string;
  containerNo: string;
}

interface LineDraft {
  item: string;
  qty: string;
  uom: string;
  unitCost: string;
}

const STATUS_FLOW: Record<string, string[]> = {
  Draft: ["Approved", "Cancelled"],
  Approved: ["Shipped", "Cancelled"],
  Shipped: ["Linked", "Closed"],
  Linked: ["Closed"],
};

const STATUS_TONE: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Approved: "bg-primary/10 text-primary",
  Shipped: "bg-warning/15 text-[#9A6212]",
  Linked: "bg-accent text-accent-foreground",
  Closed: "bg-success/10 text-success",
  Cancelled: "bg-danger/10 text-danger",
};

const EMPTY_LINE: LineDraft = { item: "", qty: "", uom: "Box", unitCost: "" };

export function PurchaseOrderWorkspace({
  orders,
  suppliers,
  containers,
  canWrite,
}: {
  orders: PoRow[];
  suppliers: SupplierOption[];
  containers: ContainerOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create-form state
  const [supplierId, setSupplierId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [currency, setCurrency] = useState<"USD" | "AED" | "INR">("USD");
  const [estimatedFreight, setEstimatedFreight] = useState("");
  const [estimatedDuties, setEstimatedDuties] = useState("");
  const [estimatedLocalCosts, setEstimatedLocalCosts] = useState("");
  const [advance, setAdvance] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);

  const goodsValue = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.unitCost) || 0),
        0
      ),
    [lines]
  );
  const estimatedTotal =
    goodsValue +
    (Number(estimatedFreight) || 0) +
    (Number(estimatedDuties) || 0) +
    (Number(estimatedLocalCosts) || 0);

  const openOrders = orders.filter((o) => !["Closed", "Cancelled"].includes(o.status));
  const withActuals = orders.filter((o) => o.actualLandedCost != null);

  function resetForm() {
    setSupplierId("");
    setContainerId("");
    setCurrency("USD");
    setEstimatedFreight("");
    setEstimatedDuties("");
    setEstimatedLocalCosts("");
    setAdvance("");
    setNotes("");
    setLines([{ ...EMPTY_LINE }]);
  }

  async function createPo() {
    if (!supplierId) return toast.error("Select a supplier");
    const validLines = lines.filter(
      (line) => line.item.trim().length >= 2 && Number(line.qty) > 0
    );
    if (validLines.length === 0) {
      return toast.error("Add at least one line with an item and quantity");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          containerId: containerId || undefined,
          currency,
          estimatedFreight: Number(estimatedFreight) || undefined,
          estimatedDuties: Number(estimatedDuties) || undefined,
          estimatedLocalCosts: Number(estimatedLocalCosts) || undefined,
          advancePaidAmount: Number(advance) || undefined,
          notes: notes.trim() || undefined,
          lines: validLines.map((line) => ({
            item: line.item.trim(),
            qty: Number(line.qty),
            uom: line.uom,
            unitCost: Number(line.unitCost) || 0,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create purchase order");
        return;
      }
      toast.success(`Purchase order ${json.data.poNo} created`);
      setDialogOpen(false);
      resetForm();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function transition(order: PoRow, status: string) {
    setBusyId(order.id);
    try {
      const res = await fetch(`/api/purchase-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update status");
        return;
      }
      toast.success(`${order.poNo} → ${status}`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function recordActual(order: PoRow) {
    const value = window.prompt(
      `Actual landed cost for ${order.poNo} (${order.currency}). Estimate was ${formatMoney(order.estimatedTotal, order.currency)}:`
    );
    if (value == null) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      return toast.error("Enter a valid amount");
    }
    setBusyId(order.id);
    try {
      const res = await fetch(`/api/purchase-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualLandedCost: amount }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to record landed cost");
        return;
      }
      toast.success("Actual landed cost recorded");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="label-caps">Open POs</p>
            <p className="font-financial mt-1.5 text-xl font-bold">{openOrders.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Draft through Linked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="label-caps">With actuals recorded</p>
            <p className="font-financial mt-1.5 text-xl font-bold">
              {withActuals.length}/{orders.length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Estimate vs actual coverage</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="label-caps">Cost overruns</p>
            <p
              className={cn(
                "font-financial mt-1.5 text-xl font-bold",
                withActuals.some((o) => (o.varianceAmount ?? 0) > 0)
                  ? "text-danger"
                  : "text-success"
              )}
            >
              {withActuals.filter((o) => (o.varianceAmount ?? 0) > 0).length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Actual above estimate</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">
          {orders.length} purchase order{orders.length === 1 ? "" : "s"} (latest 100)
        </p>
        {canWrite && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> New Purchase Order
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>PO No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Container</TableHead>
              <TableHead>Goods</TableHead>
              <TableHead>Est. landed</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Variance</TableHead>
              <TableHead>Status</TableHead>
              {canWrite && <TableHead className="w-40" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={canWrite ? 10 : 9} className="h-40">
                  <EmptyState
                    icon={FileSpreadsheet}
                    title="No purchase orders yet"
                    description="Raise a PO against a supplier, link it to the container when booked, and record the actual landed cost to see estimate-vs-actual variance."
                    className="border-0 bg-transparent py-4"
                  />
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const nextStatuses = STATUS_FLOW[order.status] ?? [];
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-[13px] font-medium">
                      {order.poNo}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[13px]">
                      {new Date(order.poDate).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>{order.supplierName}</TableCell>
                    <TableCell className="font-financial text-[13px]">
                      {order.containerNo ?? "—"}
                    </TableCell>
                    <TableCell className="font-financial text-[13px]">
                      {formatMoney(order.estimatedGoodsValue, order.currency)}
                    </TableCell>
                    <TableCell className="font-financial text-[13px]">
                      {formatMoney(order.estimatedTotal, order.currency)}
                    </TableCell>
                    <TableCell className="font-financial text-[13px]">
                      {order.actualLandedCost == null
                        ? "—"
                        : formatMoney(order.actualLandedCost, order.currency)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-financial text-[13px] font-medium",
                        order.varianceAmount == null
                          ? "text-muted-foreground"
                          : order.varianceAmount > 0
                            ? "text-danger"
                            : "text-success"
                      )}
                    >
                      {order.varianceAmount == null
                        ? "—"
                        : `${order.varianceAmount > 0 ? "+" : ""}${formatMoney(order.varianceAmount, order.currency)}`}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium",
                          STATUS_TONE[order.status] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {order.status}
                      </span>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {nextStatuses.map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              variant={status === "Cancelled" ? "ghost" : "outline"}
                              disabled={busyId === order.id}
                              onClick={() => transition(order, status)}
                              className={cn(
                                status === "Cancelled" && "text-danger hover:text-danger"
                              )}
                            >
                              {status}
                            </Button>
                          ))}
                          {order.actualLandedCost == null &&
                            !["Draft", "Cancelled"].includes(order.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === order.id}
                                onClick={() => recordActual(order)}
                              >
                                Record actual
                              </Button>
                            )}
                          {busyId === order.id && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>
              Commit terms with the supplier now; link the container and record
              the actual landed cost later to track variance.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Supplier *</Label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "AED" | "INR")}
                className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
                <option value="INR">INR</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label>Link container (optional)</Label>
              <select
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Not booked yet</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.containerNo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lines *</Label>
            {lines.map((line, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Input
                  value={line.item}
                  onChange={(e) =>
                    setLines(lines.map((l, i) => (i === index ? { ...l, item: e.target.value } : l)))
                  }
                  placeholder="Item (e.g. Red Globe Grapes)"
                  className="min-w-44 flex-1"
                />
                <Input
                  value={line.qty}
                  onChange={(e) =>
                    setLines(lines.map((l, i) => (i === index ? { ...l, qty: e.target.value } : l)))
                  }
                  placeholder="Qty"
                  type="number"
                  min="0"
                  className="w-24 font-financial"
                />
                <select
                  value={line.uom}
                  onChange={(e) =>
                    setLines(lines.map((l, i) => (i === index ? { ...l, uom: e.target.value } : l)))
                  }
                  className="flex h-9 rounded-md border border-input bg-surface px-2 text-sm shadow-sm"
                >
                  {["Box", "Kg", "Pallet", "Carton", "CasePack"].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <Input
                  value={line.unitCost}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, i) => (i === index ? { ...l, unitCost: e.target.value } : l))
                    )
                  }
                  placeholder="Unit cost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-28 font-financial"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={lines.length === 1}
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Est. freight</Label>
              <Input
                value={estimatedFreight}
                onChange={(e) => setEstimatedFreight(e.target.value)}
                type="number"
                min="0"
                className="font-financial"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Est. duties</Label>
              <Input
                value={estimatedDuties}
                onChange={(e) => setEstimatedDuties(e.target.value)}
                type="number"
                min="0"
                className="font-financial"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Est. local costs</Label>
              <Input
                value={estimatedLocalCosts}
                onChange={(e) => setEstimatedLocalCosts(e.target.value)}
                type="number"
                min="0"
                className="font-financial"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Advance paid</Label>
              <Input
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
                type="number"
                min="0"
                className="font-financial"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Terms, season, incoterms… (optional)"
            />
          </div>

          <div className="rounded-md border border-border bg-surface-alt/40 px-3 py-2 text-[13px]">
            Goods value:{" "}
            <span className="font-financial font-medium">{formatMoney(goodsValue, currency)}</span>
            {" · "}Estimated landed total:{" "}
            <span className="font-financial font-medium">{formatMoney(estimatedTotal, currency)}</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={createPo} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
