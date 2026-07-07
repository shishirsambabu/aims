"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Columns3,
  Flag,
  PackageSearch,
  Rows3,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/containers/StatusBadge";
import { cn, formatINR, marginColor } from "@/lib/utils";
import { CONTAINER_STATUSES, CONTAINER_STATUS_LABELS } from "@/lib/constants";
import type { ContainerListRow } from "@/lib/data/containers";
import type { ContainerStatus } from "@/types";

const VIEW_STORAGE_KEY = "aims.containerTable.views.v1";

type Density = "comfortable" | "compact";
type SavedTableView = {
  name: string;
  density: Density;
  columnVisibility: Record<string, boolean>;
};

function readSavedViews(): SavedTableView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedViews(views: SavedTableView[]) {
  window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(views));
}

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
  const [density, setDensity] = useState<Density>("comfortable");
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [savedViews, setSavedViews] = useState<SavedTableView[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSavedViews(readSavedViews());
  }, []);

  function saveCurrentView() {
    const name = window.prompt("Name this table view:", "Operations review");
    if (!name?.trim()) return;
    const nextView: SavedTableView = {
      name: name.trim(),
      density,
      columnVisibility,
    };
    const next = [
      ...savedViews.filter((view) => view.name !== nextView.name),
      nextView,
    ].slice(-8);
    setSavedViews(next);
    writeSavedViews(next);
    toast.success(`Saved view "${nextView.name}"`);
  }

  function applySavedView(view: SavedTableView) {
    setDensity(view.density);
    setColumnVisibility(view.columnVisibility);
    toast.success(`Applied view "${view.name}"`);
  }

  function deleteSavedView(name: string) {
    const next = savedViews.filter((view) => view.name !== name);
    setSavedViews(next);
    writeSavedViews(next);
    toast.success(`Deleted view "${name}"`);
  }

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
        enableHiding: false,
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
        accessorKey: "warehouseName",
        header: "Warehouse",
        cell: ({ row }) => row.original.warehouseName ?? "—",
      },
      {
        accessorKey: "port",
        header: "Port",
        cell: ({ row }) => row.original.port ?? "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        enableHiding: false,
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
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card/90 p-2 shadow-sm">
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <Rows3 className="h-4 w-4" />
          <span>Table view</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-border bg-background p-1">
            {(["comfortable", "compact"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDensity(mode)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                  density === mode
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-surface-alt hover:text-foreground"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4" /> Views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Saved table views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedViews.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No saved views yet. Save your current density and columns.
                </p>
              ) : (
                savedViews.map((view) => (
                  <div
                    key={view.name}
                    className="flex items-center gap-1 rounded-sm px-2 py-1 hover:bg-surface-alt"
                  >
                    <button
                      type="button"
                      onClick={() => applySavedView(view)}
                      className="min-w-0 flex-1 truncate text-left text-sm"
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSavedView(view.name)}
                      className="rounded p-1 text-muted-foreground hover:text-danger"
                      aria-label={`Delete ${view.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
              <DropdownMenuSeparator />
              <button
                type="button"
                onClick={saveCurrentView}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-alt"
              >
                <Save className="h-4 w-4" /> Save current view
              </button>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-4 w-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-alt"
                  >
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    {String(column.columnDef.header ?? column.id)}
                  </label>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
                  <TableCell
                    key={cell.id}
                    className={density === "compact" ? "py-2" : undefined}
                  >
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
                <EmptyState
                  icon={PackageSearch}
                  title="No containers match this view"
                  description="Try clearing a filter, changing the date range, or searching by Container No / BL No."
                  className="border-0 bg-transparent py-6"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
