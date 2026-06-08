"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { Flag, Package, Ship, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ContainerListRow } from "@/lib/data/containers";

export function KanbanCard({
  row,
  overlay,
}: {
  row: ContainerListRow;
  overlay?: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: row.id, data: { status: row.status } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={cn(
        "group cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-1 shadow-lg"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-financial text-sm font-semibold">
          {row.containerNo}
        </span>
        <div className="flex items-center gap-1.5">
          {row.flagged && <Flag className="h-3.5 w-3.5 text-danger" />}
          {!overlay && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => router.push(`/containers/${row.id}`)}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
              title="Open container"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="font-financial text-xs text-muted-foreground">
        BL {row.blNo}
      </p>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {row.supplierName && (
          <p className="truncate font-medium text-foreground">
            {row.supplierName}
          </p>
        )}
        <div className="flex items-center gap-3">
          {row.port && (
            <span className="inline-flex items-center gap-1">
              <Ship className="h-3 w-3" /> {row.port}
            </span>
          )}
          {row.noOfBoxes != null && (
            <span className="font-financial inline-flex items-center gap-1">
              <Package className="h-3 w-3" /> {row.noOfBoxes}
            </span>
          )}
        </div>
        {row.item && <p className="truncate">{row.item}</p>}
      </div>
    </div>
  );
}
