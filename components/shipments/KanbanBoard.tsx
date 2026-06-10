"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";

import { KanbanCard } from "@/components/shipments/KanbanCard";
import { cn } from "@/lib/utils";
import { CONTAINER_STATUSES, CONTAINER_STATUS_LABELS } from "@/lib/constants";
import type { ContainerListRow } from "@/lib/data/containers";
import type { ContainerStatus } from "@/types";

type Grouped = Record<ContainerStatus, ContainerListRow[]>;

function group(rows: ContainerListRow[]): Grouped {
  const g = {} as Grouped;
  for (const s of CONTAINER_STATUSES) g[s] = [];
  for (const r of rows) (g[r.status] ??= []).push(r);
  return g;
}

export function KanbanBoard({
  rows,
  canEdit,
}: {
  rows: ContainerListRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState<Grouped>(() => group(rows));
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeRow = useMemo(() => {
    if (!activeId) return null;
    for (const s of CONTAINER_STATUSES) {
      const found = columns[s].find((r) => r.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, columns]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const id = String(active.id);
    const from = active.data.current?.status as ContainerStatus | undefined;
    const to = over.id as ContainerStatus;
    if (!from || from === to || !CONTAINER_STATUSES.includes(to)) return;

    const card = columns[from].find((r) => r.id === id);
    if (!card) return;

    // Optimistic move.
    const prev = columns;
    setColumns((c) => ({
      ...c,
      [from]: c[from].filter((r) => r.id !== id),
      [to]: [{ ...card, status: to }, ...c[to]],
    }));

    try {
      const res = await fetch(`/api/containers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to update status");
        setColumns(prev); // revert
        return;
      }
      toast.success(
        `${card.containerNo} → ${CONTAINER_STATUS_LABELS[to]}`
      );
      router.refresh();
    } catch {
      toast.error("Network error");
      setColumns(prev);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={canEdit ? onDragEnd : undefined}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {CONTAINER_STATUSES.map((status) => (
          <div key={status} className="flex h-full">
            {status === "PartiallySold" && (
              <div className="mr-4 flex h-full flex-col items-center justify-start">
                <div className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary [writing-mode:vertical-rl]">
                  Handoff → Sales Team
                </div>
                <div className="mt-2 w-px flex-1 bg-border" />
              </div>
            )}
            <Column status={status} rows={columns[status]} disabled={!canEdit} />
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeRow ? <KanbanCard row={activeRow} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  rows,
  disabled,
}: {
  status: ContainerStatus;
  rows: ContainerListRow[];
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">
          {CONTAINER_STATUS_LABELS[status]}
        </h3>
        <span className="font-financial rounded-full bg-surface-alt px-2 py-0.5 text-xs text-muted-foreground">
          {rows.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-dashed border-border bg-surface-alt/40 p-2 transition-colors scrollbar-thin",
          isOver && "border-primary bg-accent/40"
        )}
      >
        {rows.map((r) => (
          <KanbanCard key={r.id} row={r} />
        ))}
        {rows.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}
