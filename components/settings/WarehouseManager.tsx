"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2, Warehouse, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { WarehouseRecord } from "@/lib/data/warehouses";

type FormState = {
  name: string;
  code: string;
  city: string;
  state: string;
  address: string;
  storageType: string;
  temperatureMinC: string;
  temperatureMaxC: string;
  humidityTarget: string;
  capacityTonnes: string;
  coldRoomCount: string;
  isColdStorage: boolean;
  isActive: boolean;
};

const empty: FormState = {
  name: "",
  code: "",
  city: "",
  state: "",
  address: "",
  storageType: "Cold Storage",
  temperatureMinC: "",
  temperatureMaxC: "",
  humidityTarget: "",
  capacityTonnes: "",
  coldRoomCount: "",
  isColdStorage: true,
  isActive: true,
};

export function WarehouseManager({
  warehouses,
  canEdit,
}: {
  warehouses: WarehouseRecord[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRecord | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(w: WarehouseRecord) {
    setEditing(w);
    setForm({
      name: w.name,
      code: w.code,
      city: w.city,
      state: w.state ?? "",
      address: w.address ?? "",
      storageType: w.storageType ?? "",
      temperatureMinC: w.temperatureMinC == null ? "" : String(w.temperatureMinC),
      temperatureMaxC: w.temperatureMaxC == null ? "" : String(w.temperatureMaxC),
      humidityTarget: w.humidityTarget == null ? "" : String(w.humidityTarget),
      capacityTonnes: w.capacityTonnes == null ? "" : String(w.capacityTonnes),
      coldRoomCount: w.coldRoomCount == null ? "" : String(w.coldRoomCount),
      isColdStorage: w.isColdStorage,
      isActive: w.isActive,
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const url = editing ? `/api/warehouses/${editing.id}` : "/api/warehouses";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save warehouse");
        return;
      }
      toast.success(editing ? "Warehouse updated" : "Warehouse created");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(w: WarehouseRecord) {
    if (!confirm(`Deactivate warehouse "${w.name}"?`)) return;
    const res = await fetch(`/api/warehouses/${w.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error ?? "Failed to deactivate warehouse");
      return;
    }
    toast.success("Warehouse deactivated");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add Warehouse
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Edit Warehouse" : "Add Warehouse"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Name">
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Kochi Cold Store 1"
                    />
                  </Field>
                  <Field label="Code">
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="INCOK1"
                    />
                  </Field>
                  <Field label="City">
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Kochi"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="State">
                    <Input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                    />
                  </Field>
                  <Field label="Storage Type">
                    <Input
                      value={form.storageType}
                      onChange={(e) =>
                        setForm({ ...form, storageType: e.target.value })
                      }
                      placeholder="Cold Storage"
                    />
                  </Field>
                  <Field label="Address">
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </Field>
                  <Field label="Capacity (tonnes)">
                    <Input
                      type="number"
                      value={form.capacityTonnes}
                      onChange={(e) =>
                        setForm({ ...form, capacityTonnes: e.target.value })
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Temp Min C">
                    <Input
                      type="number"
                      value={form.temperatureMinC}
                      onChange={(e) =>
                        setForm({ ...form, temperatureMinC: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Temp Max C">
                    <Input
                      type="number"
                      value={form.temperatureMaxC}
                      onChange={(e) =>
                        setForm({ ...form, temperatureMaxC: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Humidity %">
                    <Input
                      type="number"
                      value={form.humidityTarget}
                      onChange={(e) =>
                        setForm({ ...form, humidityTarget: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Cold Rooms">
                    <Input
                      type="number"
                      value={form.coldRoomCount}
                      onChange={(e) =>
                        setForm({ ...form, coldRoomCount: e.target.value })
                      }
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isColdStorage}
                      onChange={(e) =>
                        setForm({ ...form, isColdStorage: e.target.checked })
                      }
                    />
                    Cold storage
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm({ ...form, isActive: e.target.checked })
                      }
                    />
                    Active
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button onClick={save} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Warehouse
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Warehouse</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Cold Chain</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead className="text-right">Containers</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 6 : 5}
                  className="h-40 text-center text-muted-foreground"
                >
                  <EmptyState
                    icon={Warehouse}
                    title="No warehouses yet"
                    description="Create the pilot warehouse first so containers can be assigned before they enter stock."
                    className="border-0 bg-transparent py-6"
                  />
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((w) => (
                <TableRow key={w.id} className={w.isActive ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">
                      {w.name} <span className="text-muted-foreground">({w.code})</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {w.state ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>{w.city}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {w.isColdStorage ? "Cold storage" : "Ambient"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {w.temperatureMinC != null || w.temperatureMaxC != null
                        ? `${w.temperatureMinC ?? "?"}°C to ${w.temperatureMaxC ?? "?"}°C`
                        : "No temperature band set"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {w.capacityTonnes != null ? `${w.capacityTonnes} t` : "—"}
                  </TableCell>
                  <TableCell className="font-financial text-right">
                    {w.containerCount}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(w)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-primary"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(w)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger"
                          title="Deactivate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
