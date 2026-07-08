"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package2, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { ItemRow } from "@/lib/data/items";

const UOMS = ["Box", "Kg", "Pallet", "Punnet", "Container", "Carton", "CasePack"] as const;

interface ItemDraft {
  code: string;
  name: string;
  variety: string;
  grade: string;
  hsnCode: string;
  defaultUom: string;
  packSpec: string;
}

const EMPTY_DRAFT: ItemDraft = {
  code: "",
  name: "",
  variety: "",
  grade: "",
  hsnCode: "",
  defaultUom: "Box",
  packSpec: "",
};

export function ItemManager({
  initialItems,
  canWrite,
}: {
  initialItems: ItemRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialItems.filter((item) => {
      if (!showInactive && !item.isActive) return false;
      if (!needle) return true;
      return [item.code, item.name, item.variety, item.grade, item.hsnCode]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [initialItems, q, showInactive]);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  }

  function openEdit(item: ItemRow) {
    setEditing(item);
    setDraft({
      code: item.code,
      name: item.name,
      variety: item.variety ?? "",
      grade: item.grade ?? "",
      hsnCode: item.hsnCode ?? "",
      defaultUom: item.defaultUom,
      packSpec: item.packSpec ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) return toast.error("Item name is required");
    setSaving(true);
    try {
      const payload = {
        ...(draft.code.trim() ? { code: draft.code.trim() } : {}),
        name: draft.name.trim(),
        variety: draft.variety.trim() || null,
        grade: draft.grade.trim() || null,
        hsnCode: draft.hsnCode.trim() || null,
        defaultUom: draft.defaultUom,
        packSpec: draft.packSpec.trim() || null,
      };
      const res = await fetch(editing ? `/api/items/${editing.id}` : "/api/items", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save item");
        return;
      }
      toast.success(editing ? "Item updated" : `Item ${json.data.code} created`);
      setDialogOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setActive(item: ItemRow, isActive: boolean) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update item");
        return;
      }
      toast.success(`${item.code} ${isActive ? "activated" : "deactivated"}`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, name, variety, HSN…"
            className="pl-8"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Item
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Variety</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Linked</TableHead>
              <TableHead>Status</TableHead>
              {canWrite && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={canWrite ? 9 : 8} className="h-36">
                  <EmptyState
                    icon={Package2}
                    title="No items match"
                    description="The item master was backfilled from existing container and stock names — clear the search, or create the first item."
                    className="border-0 bg-transparent py-4"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className={cn(!item.isActive && "opacity-60")}>
                  <TableCell className="font-mono text-[13px]">{item.code}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.variety ?? "—"}</TableCell>
                  <TableCell>{item.grade ?? "—"}</TableCell>
                  <TableCell className="font-mono text-[13px]">{item.hsnCode ?? "—"}</TableCell>
                  <TableCell>{item.defaultUom}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {item.containerCount} ctn · {item.stockLotCount} lots · {item.priceLineCount} prices
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-medium",
                        item.isActive
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit ${item.code}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === item.id}
                          onClick={() => setActive(item, !item.isActive)}
                        >
                          {busyId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : item.isActive ? (
                            "Deactivate"
                          ) : (
                            "Activate"
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.code}` : "New item"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Changes apply everywhere this item is referenced."
                : "Leave the code blank to auto-assign the next ITM-XXXX."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-code">Code</Label>
              <Input
                id="item-code"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="Auto (ITM-0001)"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Name *</Label>
              <Input
                id="item-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Red Globe Grapes"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-variety">Variety</Label>
              <Input
                id="item-variety"
                value={draft.variety}
                onChange={(e) => setDraft({ ...draft, variety: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-grade">Grade</Label>
              <Input
                id="item-grade"
                value={draft.grade}
                onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-hsn">HSN code</Label>
              <Input
                id="item-hsn"
                value={draft.hsnCode}
                onChange={(e) => setDraft({ ...draft, hsnCode: e.target.value })}
                placeholder="08061000"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-uom">Default UoM</Label>
              <select
                id="item-uom"
                value={draft.defaultUom}
                onChange={(e) => setDraft({ ...draft, defaultUom: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {UOMS.map((uom) => (
                  <option key={uom} value={uom}>
                    {uom}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="item-pack">Pack spec</Label>
              <Input
                id="item-pack"
                value={draft.packSpec}
                onChange={(e) => setDraft({ ...draft, packSpec: e.target.value })}
                placeholder="9 kg carton · 10x900g punnets"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
