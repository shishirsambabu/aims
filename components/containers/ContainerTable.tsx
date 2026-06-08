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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/containers/StatusBadge";
import { cn, formatINR, marginColor } from "@/lib/utils";
import type { ContainerListRow } from "@/lib/data/containers";

export function ContainerTable({ data }: { data: ContainerListRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

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
      },
    ],
    []
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
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
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
                  "cursor-pointer",
                  i % 2 === 1 && "bg-surface-alt/30"
                )}
              >
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
                colSpan={columns.length}
                className="h-32 text-center text-muted-foreground"
              >
                No containers match your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
