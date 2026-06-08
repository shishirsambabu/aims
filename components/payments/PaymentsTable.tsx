"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge } from "@/components/containers/StatusBadge";
import { formatMoney, formatDate, cn, expiryLevel } from "@/lib/utils";
import type { PaymentRow } from "@/lib/data/payments";

export function PaymentsTable({
  data,
  canEdit,
}: {
  data: PaymentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function record(p: PaymentRow) {
    const input = window.prompt(
      `Total amount paid so far for ${p.containerNo} (${p.currency}):`,
      String(p.amountRequested)
    );
    if (input === null) return;
    const amountPaid = Number(input);
    if (Number.isNaN(amountPaid) || amountPaid < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/payments/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to record payment");
        return;
      }
      toast.success("Payment recorded");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this payment request?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to delete");
        return;
      }
      toast.success("Payment deleted");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Container No</TableHead>
            <TableHead>BL No</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Requested</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                No payment requests yet.
              </TableCell>
            </TableRow>
          ) : (
            data.map((p) => {
              const overdue =
                p.status !== "Paid" &&
                ["expired", "critical"].includes(expiryLevel(p.dueDate));
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-financial font-medium">
                    {p.containerNo ?? "—"}
                  </TableCell>
                  <TableCell className="font-financial text-muted-foreground">
                    {p.blNo ?? "—"}
                  </TableCell>
                  <TableCell>{p.supplierName ?? "—"}</TableCell>
                  <TableCell className="font-financial text-right">
                    {formatMoney(p.amountRequested, p.currency)}
                  </TableCell>
                  <TableCell className="font-financial text-right text-success">
                    {formatMoney(p.amountPaid, p.currency)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-financial text-right",
                      p.outstanding > 0 ? "text-danger" : "text-muted-foreground"
                    )}
                  >
                    {formatMoney(p.outstanding, p.currency)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-financial",
                        overdue && "font-medium text-danger"
                      )}
                    >
                      {formatDate(p.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && p.status !== "Paid" && (
                        <button
                          onClick={() => record(p)}
                          disabled={busyId === p.id}
                          className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-success disabled:opacity-50"
                          title="Record payment"
                        >
                          <Wallet className="h-4 w-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => remove(p.id)}
                          disabled={busyId === p.id}
                          className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
