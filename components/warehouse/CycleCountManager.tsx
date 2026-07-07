"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import type { StockItemRow } from "@/lib/data/stock";
import type { WarehouseCycleCountRow, WarehouseCycleCountDetail } from "@/lib/data/warehouse-ops";

type Warehouse = { id: string; name: string; code: string; city: string };

type CountLineForm = {
  stockItemId: string;
  countedQty: string;
  reason: string;
  notes: string;
};

export function CycleCountManager({
  warehouses,
  stockItems,
  cycleCounts,
}: {
  warehouses: Warehouse[];
  stockItems: StockItemRow[];
  cycleCounts: WarehouseCycleCountRow[];
}) {
  const router = useRouter();
  const [selectedCountId, setSelectedCountId] = useState<string | null>(cycleCounts[0]?.id ?? null);
  const [detail, setDetail] = useState<WarehouseCycleCountDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [lineForm, setLineForm] = useState<CountLineForm>({ stockItemId: "", countedQty: "", reason: "", notes: "" });
  const [createForm, setCreateForm] = useState({
    warehouseId: warehouses[0]?.id ?? "",
    scheduledAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const selectedWarehouseStocks = useMemo(
    () => stockItems.filter((row) => !createForm.warehouseId || row.warehouseId === createForm.warehouseId),
    [createForm.warehouseId, stockItems]
  );

  useEffect(() => {
    if (!selectedCountId) {
      return;
    }
    let ignore = false;
    async function load() {
      setBusy(true);
      try {
        const res = await fetch(`/api/warehouse-ops/${selectedCountId}`);
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Failed to load cycle count");
          return;
        }
        if (!ignore) {
          setDetail(json.data as WarehouseCycleCountDetail);
          setLineForm({ stockItemId: "", countedQty: "", reason: "", notes: "" });
        }
      } catch {
        toast.error("Network error");
      } finally {
        if (!ignore) setBusy(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [selectedCountId]);

  async function createCount() {
    setCreateBusy(true);
    try {
      const res = await fetch("/api/warehouse-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "cycle-count",
          warehouseId: createForm.warehouseId,
          scheduledAt: createForm.scheduledAt,
          notes: createForm.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create cycle count");
        return;
      }
      toast.success("Cycle count created");
      setSelectedCountId(json.data.id);
      router.refresh();
    } finally {
      setCreateBusy(false);
    }
  }

  async function addLine() {
    if (!selectedCountId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/warehouse-ops/${selectedCountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-line",
          stockItemId: lineForm.stockItemId,
          countedQty: lineForm.countedQty,
          reason: lineForm.reason || undefined,
          notes: lineForm.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to add count line");
        return;
      }
      toast.success("Count line added");
      const refreshed = await fetch(`/api/warehouse-ops/${selectedCountId}`);
      const refreshedJson = await refreshed.json();
      if (refreshed.ok) setDetail(refreshedJson.data as WarehouseCycleCountDetail);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function postVariance() {
    if (!selectedCountId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/warehouse-ops/${selectedCountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post-variance" }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to post variance");
        return;
      }
      toast.success("Variance posted and count completed");
      const refreshed = await fetch(`/api/warehouse-ops/${selectedCountId}`);
      const refreshedJson = await refreshed.json();
      if (refreshed.ok) setDetail(refreshedJson.data as WarehouseCycleCountDetail);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="label-caps">Cycle Counts</p>
              <h3 className="font-heading text-lg font-semibold">Stock verification runs</h3>
            </div>
            <Button variant="outline" onClick={() => {
              setSelectedCountId(null);
              setDetail(null);
            }}>
              <Plus className="h-4 w-4" /> New count
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {cycleCounts.map((count) => (
              <button
                key={count.id}
                onClick={() => setSelectedCountId(count.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedCountId === count.id ? "border-primary bg-primary/5" : "border-border bg-background"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{count.countNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {count.warehouseId} · {count.lineCount} lines
                    </p>
                  </div>
                  <Badge variant="outline">{count.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {count.scheduledAt ? formatDate(count.scheduledAt) : "No schedule"}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="label-caps">{detail?.countNo ?? "New Cycle Count"}</p>
              <h3 className="font-heading text-lg font-semibold">
                {detail ? "Enter actuals and post variance" : "Create count run"}
              </h3>
            </div>
            {busy ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
          </div>

          {!detail ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Warehouse">
                <Select value={createForm.warehouseId} onValueChange={(value) => setCreateForm((current) => ({ ...current, warehouseId: value }))}>
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
              <Field label="Scheduled">
                <Input type="date" value={createForm.scheduledAt} onChange={(e) => setCreateForm((current) => ({ ...current, scheduledAt: e.target.value }))} />
              </Field>
              <Field label="Notes">
                <Textarea value={createForm.notes} onChange={(e) => setCreateForm((current) => ({ ...current, notes: e.target.value }))} rows={3} />
              </Field>
              <div className="flex items-end">
                <Button onClick={createCount} disabled={createBusy}>
                  {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create count
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Meta label="Status" value={detail.status} />
                <Meta label="Lines" value={String(detail.lineCount)} />
                <Meta label="Warehouse" value={`${detail.warehouse.name} (${detail.warehouse.code})`} />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Stock lot">
                  <Select value={lineForm.stockItemId} onValueChange={(value) => setLineForm((current) => ({ ...current, stockItemId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Choose lot" /></SelectTrigger>
                    <SelectContent>
                      {selectedWarehouseStocks.map((stock) => (
                        <SelectItem key={stock.id} value={stock.id}>
                          {stock.containerNo} · {stock.item} · {stock.qtyAvailable}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Counted qty">
                  <Input value={lineForm.countedQty} onChange={(e) => setLineForm((current) => ({ ...current, countedQty: e.target.value }))} />
                </Field>
                <Field label="Reason">
                  <Input value={lineForm.reason} onChange={(e) => setLineForm((current) => ({ ...current, reason: e.target.value }))} />
                </Field>
                <Field label="Notes">
                  <Input value={lineForm.notes} onChange={(e) => setLineForm((current) => ({ ...current, notes: e.target.value }))} />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={addLine} disabled={busy || !lineForm.stockItemId}>
                  Add line
                </Button>
                <Button variant="outline" onClick={postVariance} disabled={busy || detail.status === "Completed"}>
                  <CheckCircle2 className="h-4 w-4" /> Post variance
                </Button>
              </div>

              <div className="mt-6 space-y-2">
                {detail.lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No count lines yet.</p>
                ) : (
                  detail.lines.map((line) => (
                    <div key={line.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{line.stockItem.containerNo} · {line.item}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.stockItem.blNo} · {line.stockItem.warehouseName} · {line.stockItem.locationCode ?? "No location"}
                          </p>
                        </div>
                        <Badge variant={line.variance === 0 ? "outline" : line.variance > 0 ? "success" : "danger"}>
                          Variance {line.variance}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                        <Meta label="Expected" value={String(line.expectedQty)} />
                        <Meta label="Counted" value={String(line.countedQty)} />
                        <Meta label="Reason" value={line.reason ?? "None"} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
