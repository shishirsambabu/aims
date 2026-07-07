"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Trash2, Check, X, ReceiptText } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
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

function dueLabel(dueDate: string | null, dueAgeDays: number | null) {
  if (!dueDate) return "No due date";
  if (dueAgeDays == null) return formatDate(dueDate);
  if (dueAgeDays > 0) return `${formatDate(dueDate)} · overdue ${dueAgeDays}d`;
  if (dueAgeDays === 0) return `${formatDate(dueDate)} · due today`;
  return `${formatDate(dueDate)} · due in ${Math.abs(dueAgeDays)}d`;
}

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
    const reason =
      action === "reject"
        ? window.prompt("Why are you rejecting this payment request?")
        : window.prompt("Approval note (optional):") ?? "";
    if (action === "reject" && !reason?.trim()) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
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
      `Total amount paid so far for ${p.containerNo ?? "this container"} (${p.currency}):`,
      String(p.amountRequested)
    );
    if (input === null) return;
    const amountPaid = Number(input);
    if (Number.isNaN(amountPaid) || amountPaid < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const reason = window.prompt("Payment update reason / reference for audit trail:");
    if (!reason?.trim()) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/payments/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid, reason }),
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
    const reason = window.prompt(
      "Why are you archiving this payment request? This will be kept in the audit trail."
    );
    if (!reason?.trim()) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
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
                <EmptyState
                  icon={ReceiptText}
                  title="No payment requests yet"
                  description="Payment requests will appear here after finance raises them against containers. Approved requests can then be paid."
                  className="border-0 bg-transparent py-6"
                />
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
                    {p.containerNo ?? "-"}
                  </TableCell>
                  <TableCell className="font-financial text-muted-foreground">
                    {p.blNo ?? "-"}
                  </TableCell>
                  <TableCell>{p.supplierName ?? "-"}</TableCell>
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
                      {dueLabel(p.dueDate, p.dueAgeDays)}
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
