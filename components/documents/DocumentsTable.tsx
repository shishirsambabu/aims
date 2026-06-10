"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocStatusBadge } from "@/components/containers/StatusBadge";
import { cn, formatDate, expiryLevel } from "@/lib/utils";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import type { DocumentRow } from "@/lib/data/documents";

const ROW_TINT: Record<string, string> = {
  expired: "bg-danger/[0.06]",
  critical: "bg-danger/[0.06]",
  warning: "bg-warning/[0.08]",
  ok: "",
  none: "",
};

export function DocumentsTable({
  data,
  canEdit,
}: {
  data: DocumentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function verify(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Verified" }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to verify");
        return;
      }
      toast.success("Document verified");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    const reason = window.prompt(
      "Why are you archiving this document? This will be kept in the audit trail."
    );
    if (!reason?.trim()) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to delete");
        return;
      }
      toast.success("Document archived");
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
            <TableHead>Type</TableHead>
            <TableHead>Doc No</TableHead>
            <TableHead>Container No</TableHead>
            <TableHead>BL No</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                No documents match your filters.
              </TableCell>
            </TableRow>
          ) : (
            data.map((d) => {
              const level = expiryLevel(d.expiryDate);
              return (
                <TableRow key={d.id} className={cn(ROW_TINT[level])}>
                  <TableCell className="font-medium">
                    {DOCUMENT_TYPE_LABELS[d.type]}
                  </TableCell>
                  <TableCell className="font-financial text-muted-foreground">
                    {d.docNo ?? "—"}
                  </TableCell>
                  <TableCell className="font-financial">{d.containerNo ?? "—"}</TableCell>
                  <TableCell className="font-financial text-muted-foreground">
                    {d.blNo ?? "—"}
                  </TableCell>
                  <TableCell>{d.supplierName ?? "—"}</TableCell>
                  <TableCell className="font-financial">{formatDate(d.issueDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-financial">{formatDate(d.expiryDate)}</span>
                      {(level === "critical" || level === "expired") && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                          <AlertTriangle className="h-3 w-3" />
                          {level === "expired" ? "Expired" : "Expiring Soon"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DocStatusBadge status={d.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {d.fileName && (
                        <a
                          href={`/api/documents/${d.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-primary"
                          title="Open file (secure link)"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {canEdit && d.status !== "Verified" && (
                        <button
                          onClick={() => verify(d.id)}
                          disabled={busyId === d.id}
                          className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-success disabled:opacity-50"
                          title="Mark verified"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => remove(d.id)}
                          disabled={busyId === d.id}
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
