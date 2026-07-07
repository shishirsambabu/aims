"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Thermometer, ShieldAlert } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

type WarehouseOption = { id: string; name: string; code: string; city: string };
type LocationOption = {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
};
type ColdChainData = {
  summary: { readings: number; openTasks: number; criticalTasks: number; resolvedTasks: number };
  readings: {
    id: string;
    warehouseName: string;
    locationName: string | null;
    recordedAt: string;
    temperatureC: number | null;
    humidityPct: number | null;
    source: string;
    targetMinC: number | null;
    targetMaxC: number | null;
  }[];
  tasks: {
    id: string;
    taskNo: string;
    warehouseName: string;
    locationName: string | null;
    severity: string;
    status: string;
    title: string;
    description: string | null;
    actualTempC: number | null;
    createdAt: string;
  }[];
};

export function ColdChainWorkspace({
  data,
  warehouses,
  locations,
  canManage,
}: {
  data: ColdChainData;
  warehouses: WarehouseOption[];
  locations: LocationOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    warehouseId: warehouses[0]?.id ?? "",
    locationId: "",
    recordedAt: new Date().toISOString().slice(0, 16),
    temperatureC: "",
    humidityPct: "",
    notes: "",
  });
  const [resolutionDialog, setResolutionDialog] = useState({
    open: false,
    taskId: "",
    notes: "",
  });
  const warehouseLocations = locations.filter((location) => location.warehouseId === form.warehouseId);

  async function recordReading() {
    setBusy(true);
    try {
      const res = await fetch("/api/cold-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "reading",
          ...form,
          locationId: form.locationId || undefined,
          temperatureC: Number(form.temperatureC),
          humidityPct: form.humidityPct ? Number(form.humidityPct) : undefined,
          source: "Manual",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not record reading");
        return;
      }
      toast.success(json.data?.task ? "Reading recorded and breach task opened" : "Reading recorded");
      setForm({ ...form, temperatureC: "", humidityPct: "", notes: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateTask(taskId: string, action: "acknowledge" | "resolve" | "escalate") {
    if (action === "resolve") {
      setResolutionDialog({ open: true, taskId, notes: "" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/cold-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "task-action", taskId, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not update temperature task");
        return;
      }
      toast.success("Temperature task updated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitResolution() {
    const resolutionNotes = resolutionDialog.notes.trim();
    if (!resolutionNotes) {
      toast.error("Resolution notes are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/cold-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "task-action",
          taskId: resolutionDialog.taskId,
          action: "resolve",
          resolutionNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not resolve temperature task");
        return;
      }
      toast.success("Temperature task resolved");
      setResolutionDialog({ open: false, taskId: "", notes: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-[1.5rem]">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label-caps">Cold-chain telemetry</p>
            <h3 className="font-heading text-lg font-semibold">Readings and breach tasks</h3>
          </div>
          <Thermometer className="h-5 w-5 text-primary" />
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Mini label="Readings" value={data.summary.readings} />
          <Mini label="Open tasks" value={data.summary.openTasks} />
          <Mini label="Critical" value={data.summary.criticalTasks} tone="text-danger" />
          <Mini label="Resolved" value={data.summary.resolvedTasks} tone="text-success" />
        </div>

        {canManage ? (
          <div className="grid gap-3 rounded-2xl border border-border bg-surface-alt/30 p-4 md:grid-cols-3">
            <Select
              value={form.warehouseId}
              onValueChange={(value) => setForm({ ...form, warehouseId: value, locationId: "" })}
            >
              <SelectTrigger><SelectValue placeholder="Warehouse" /></SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.locationId || "none"} onValueChange={(value) => setForm({ ...form, locationId: value === "none" ? "" : value })}>
              <SelectTrigger><SelectValue placeholder="Room / zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Warehouse default</SelectItem>
                {warehouseLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.code} - {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="datetime-local" value={form.recordedAt} onChange={(e) => setForm({ ...form, recordedAt: e.target.value })} />
            <Input type="number" step="0.1" placeholder="Temperature C" value={form.temperatureC} onChange={(e) => setForm({ ...form, temperatureC: e.target.value })} />
            <Input type="number" step="0.1" placeholder="Humidity %" value={form.humidityPct} onChange={(e) => setForm({ ...form, humidityPct: e.target.value })} />
            <Button onClick={() => void recordReading()} disabled={busy}>Record reading</Button>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-heading text-base font-semibold">Open breach tasks</h4>
            {data.tasks.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No breach tasks" description="Temperature exceptions will appear here." />
            ) : data.tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{task.taskNo} - {task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.warehouseName} - {task.locationName ?? "Warehouse default"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={task.severity === "Critical" ? "danger" : task.severity === "Warning" ? "warning" : "outline"}>{task.severity}</Badge>
                    <p className="mt-2 text-xs text-muted-foreground">{task.status}</p>
                  </div>
                </div>
                {canManage && task.status !== "Resolved" ? (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void updateTask(task.id, "acknowledge")} disabled={busy}>Acknowledge</Button>
                    <Button size="sm" variant="outline" onClick={() => void updateTask(task.id, "escalate")} disabled={busy}>Escalate</Button>
                    <Button size="sm" onClick={() => void updateTask(task.id, "resolve")} disabled={busy}>Resolve</Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="font-heading text-base font-semibold">Recent readings</h4>
            {data.readings.slice(0, 10).map((reading) => (
              <div key={reading.id} className="rounded-2xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{reading.warehouseName}</p>
                    <p className="text-xs text-muted-foreground">{reading.locationName ?? "Warehouse default"} - {formatDate(reading.recordedAt)}</p>
                    <p className="text-xs text-muted-foreground">Target {reading.targetMinC ?? "-"}C to {reading.targetMaxC ?? "-"}C</p>
                  </div>
                  <div className="text-right">
                    <p className="font-financial text-lg font-semibold">{reading.temperatureC}C</p>
                    <p className="text-xs text-muted-foreground">{reading.humidityPct ?? "-"}% RH</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <Dialog
        open={resolutionDialog.open}
        onOpenChange={(open) => setResolutionDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve temperature breach</DialogTitle>
            <DialogDescription>
              Record the corrective action before closing this cold-room task.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={resolutionDialog.notes}
            onChange={(event) =>
              setResolutionDialog((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="Moved stock to CR-02, inspected pallet, supervisor approved..."
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolutionDialog({ open: false, taskId: "", notes: "" })}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={submitResolution} disabled={busy}>
              Resolve task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-financial mt-1 text-2xl font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
