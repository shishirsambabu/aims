"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Flag, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/containers/StatusBadge";
import { cn, formatINR, marginColor } from "@/lib/utils";
import { CONTAINER_STATUSES, CONTAINER_STATUS_LABELS } from "@/lib/constants";
import type { ContainerListRow } from "@/lib/data/containers";
import type { ContainerStatus } from "@/types";

export function ContainerTable({
  data,
  showFinancials = true,
  canEdit = false,
}: {
  data: ContainerListRow[];
  showFinancials?: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) =>
      s.size === data.length ? new Set() : new Set(data.map((r) => r.id))
    );
  }

  async function runBulk(
    action: "status" | "flag" | "unflag" | "archive",
    status?: ContainerStatus
  ) {
    if (action === "archive" && !confirm(`Archive ${selected.size} container(s)?`))
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/containers/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action, status }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Bulk action failed");
        return;
      }
      const { updated, skipped } = json.data;
      toast.success(
        `${updated} updated${skipped ? `, ${skipped} skipped` : ""}`
      );
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<ColumnDef<ContainerListRow>[]>(
    () => [
      {
        accessorKey: "slNo",
        header: "Sl No",
        cell: ({ row }) => (
          <span className="font-financial text-muted-foreground">
            {row.original.slNo ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "containerNo",
        header: "Container No",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.flagged && (
              <Flag className="h-3.5 w-3.5 text-danger" />
            )}
            <span className="font-financial font-medium text-foreground">
              {row.original.containerNo}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "blNo",
        header: "BL No",
        cell: ({ row }) => (
          <span className="font-financial text-muted-foreground">
            {row.original.blNo}
          </span>
        ),
      },
      {
        accessorKey: "supplierName",
        header: "Supplier",
        cell: ({ row }) => row.original.supplierName ?? "—",
      },
      {
        accessorKey: "port",
        header: "Port",
        cell: ({ row }) => row.original.port ?? "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "docScore",
        header: "Docs",
        cell: ({ row }) => {
          const s = row.original.docScore;
          const tone =
            s === 0
              ? "bg-danger/10 text-danger"
              : s < 5
                ? "bg-warning/20 text-[#9A6212]"
                : "bg-success/15 text-success";
          return (
            <span
              className={cn(
                "font-financial inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                tone
              )}
            >
              {s}/9
            </span>
          );
        },
      },
      ...(showFinancials
        ? [
            {
              accessorKey: "profit",
              header: "Profit",
              cell: ({ row }) => {
                const { profit, marginPct } = row.original;
                if (profit == null)
                  return <span className="text-muted-foreground">—</span>;
                const up = profit >= 0;
                return (
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "font-financial inline-flex items-center gap-1 font-medium",
                        up ? "text-success" : "text-danger"
                      )}
                    >
                      {up ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {formatINR(profit)}
                    </span>
                    {marginPct != null && (
                      <span
                        className={cn(
                          "font-financial text-xs",
                          marginColor(marginPct)
                        )}
                      >
                        {marginPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                );
              },
            } as ColumnDef<ContainerListRow>,
          ]
        : []),
    ],
    [showFinancials]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-3">
      {canEdit && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-accent/40 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <select
            disabled={busy}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                runBulk("status", e.target.value as ContainerStatus);
                e.target.value = "";
              }
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Set status…</option>
            {CONTAINER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTAINER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => runBulk("flag")}>
            Flag
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => runBulk("unflag")}>
            Unflag
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => runBulk("archive")}>
            Archive
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {canEdit && (
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === data.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getCanSort() && (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row, i) => (
              <TableRow
                key={row.id}
                onClick={() =>
                  router.push(`/containers/${row.original.id}`)
                }
                className={cn(
                  "cursor-pointer transition-colors",
                  i % 2 === 1 && "bg-surface-alt/30",
                  selected.has(row.original.id) && "bg-accent/40"
                )}
              >
                {canEdit && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.original.id)}
                      onChange={() => toggle(row.original.id)}
                      aria-label="Select row"
                    />
                  </TableCell>
                )}
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length + (canEdit ? 1 : 0)}
                className="h-40 text-center text-muted-foreground"
              >
                <div className="mx-auto max-w-sm">
                  <p className="font-heading text-base font-semibold text-foreground">
                    No containers match this view
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try clearing a filter, changing the date range, or searching
                    by Container No / BL No.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
