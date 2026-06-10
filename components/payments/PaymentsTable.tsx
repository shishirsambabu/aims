"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Trash2, Check, X } from "lucide-react";
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

const APPROVAL_STYLE: Record<string, string> = {
  PendingApproval: "bg-warning/20 text-[#9A6212]",
  Approved: "bg-success/15 text-success",
  Rejected: "bg-danger/10 text-danger",
  Draft: "bg-slate-100 text-slate-700",
};
const APPROVAL_LABEL: Record<string, string> = {
  PendingApproval: "Pending Approval",
  Approved: "Approved",
  Rejected: "Rejected",
  Draft: "Draft",
};

export function PaymentsTable({
  data,
  canPay,
  canApprove,
  currentUserId,
}: {
  data: PaymentRow[];
  canPay: boolean;
  canApprove: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed");
        return;
      }
      toast.success(action === "approve" ? "Payment approved" : "Payment rejected");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

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
    if (!confirm("Archive this payment request? It will be hidden but kept in the audit trail.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to delete");
        return;
      }
      toast.success("Payment archived");
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
            <TableHead>Approval</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
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
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        APPROVAL_STYLE[p.approvalStatus]
                      )}
                    >
                      {APPROVAL_LABEL[p.approvalStatus]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Checker approves/rejects a pending request (not their own) */}
                      {canApprove &&
                        p.approvalStatus === "PendingApproval" &&
                        p.requestedById !== currentUserId && (
                          <>
                            <button
                              onClick={() => decide(p.id, "approve")}
                              disabled={busyId === p.id}
                              className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-success disabled:opacity-50"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => decide(p.id, "reject")}
                              disabled={busyId === p.id}
                              className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger disabled:opacity-50"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      {/* Pay only once approved */}
                      {canPay &&
                        p.approvalStatus === "Approved" &&
                        p.status !== "Paid" && (
                          <button
                            onClick={() => record(p)}
                            disabled={busyId === p.id}
                            className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-success disabled:opacity-50"
                            title="Record payment"
                          >
                            <Wallet className="h-4 w-4" />
                          </button>
                        )}
                      {canPay && (
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
