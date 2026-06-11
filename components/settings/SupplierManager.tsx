"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2, Truck, X } from "lucide-react";
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
import type { SupplierRecord } from "@/lib/data/suppliers";

type FormState = {
  name: string;
  country: string;
  contactName: string;
  email: string;
  phone: string;
};

function pendingActionLabel(pendingChanges: unknown) {
  if (
    pendingChanges &&
    typeof pendingChanges === "object" &&
    "action" in pendingChanges
  ) {
    return String(pendingChanges.action ?? "Change");
  }
  return "Change";
}

const empty: FormState = {
  name: "",
  country: "",
  contactName: "",
  email: "",
  phone: "",
};

export function SupplierManager({
  suppliers,
  canEdit,
  canApprove,
}: {
  suppliers: SupplierRecord[];
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(s: SupplierRecord) {
    setEditing(s);
    setForm({
      name: s.name,
      country: s.country ?? "",
      contactName: s.contactName ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const url = editing ? `/api/suppliers/${editing.id}` : "/api/suppliers";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save");
        return;
      }
      toast.success(
        editing
          ? "Supplier update submitted for approval"
          : "Supplier submitted for approval"
      );
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: SupplierRecord) {
    const reason = window.prompt(
      `Why are you requesting archive for supplier "${s.name}"?`
    );
    if (!reason?.trim()) return;
    const res = await fetch(`/api/suppliers/${s.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error ?? "Failed to request archive");
      return;
    }
    toast.success("Supplier archive submitted for approval");
    router.refresh();
  }

  async function review(s: SupplierRecord, action: "approve" | "reject") {
    const reason =
      action === "reject"
        ? window.prompt(`Why are you rejecting the supplier change for "${s.name}"?`)
        : window.prompt(`Approval note for "${s.name}" (optional):`) ?? "";
    if (action === "reject" && !reason?.trim()) return;
    const res = await fetch(`/api/suppliers/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.error ?? "Failed to review supplier");
      return;
    }
    toast.success(
      action === "approve" ? "Supplier change approved" : "Supplier change rejected"
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Edit Supplier" : "Add Supplier"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <Field label="Name">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="COSMOS GROUP"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Country">
                    <Input
                      value={form.country}
                      onChange={(e) =>
                        setForm({ ...form, country: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Contact Name">
                    <Input
                      value={form.contactName}
                      onChange={(e) =>
                        setForm({ ...form, contactName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </Field>
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
                  {busy && <Loader2 className="animate-spin" />}
                  Submit for Approval
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
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Containers</TableHead>
              {(canEdit || canApprove) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit || canApprove ? 6 : 5}
                  className="h-40 text-center text-muted-foreground"
                >
                  <EmptyState
                    icon={Truck}
                    title="No suppliers yet"
                    description="Add suppliers here first so containers, imports and document records use approved master data."
                    className="border-0 bg-transparent py-6"
                  />
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.country ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.contactName ?? s.email ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {s.approvalStatus}
                      </span>
                      {!!s.pendingChanges && (
                        <p className="max-w-xs truncate text-xs text-muted-foreground">
                          Pending: {pendingActionLabel(s.pendingChanges)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-financial text-right">
                    {s.containerCount}
                  </TableCell>
                  {(canEdit || canApprove) && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canApprove && s.approvalStatus === "PendingApproval" && (
                          <>
                            <button
                              onClick={() => review(s, "approve")}
                              className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-success"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => review(s, "reject")}
                              className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEdit(s)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-primary"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => remove(s)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger"
                              title="Request archive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
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
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
