// AIMS workflow engine — turns the status pipeline into a guarded state machine.
// Forward moves must satisfy each stage's entry criteria; backward moves are
// allowed as corrections (and are logged by the API).

import {
  CONTAINER_STATUSES,
  DOCUMENT_TYPE_LABELS,
  CONTAINER_STATUS_LABELS,
} from "@/lib/constants";
import type { ContainerStatus, DocumentType } from "@/types";

export interface WorkflowContext {
  /** Document types that have at least one verified document. */
  verifiedDocTypes: DocumentType[];
  /** Whether sales have been recorded (sale value present). */
  hasSales: boolean;
  /** Whether the container has an assigned warehouse before inbound stock. */
  hasWarehouse: boolean;
}

export interface StageRequirement {
  docs: DocumentType[];
  needsSales: boolean;
}

// Document(s) that must exist before a container may ENTER a stage.
const STAGE_DOC_REQUIREMENTS: Partial<Record<ContainerStatus, DocumentType[]>> = {
  CustomsClearance: ["BillOfLading"],
  Cleared: ["BillOfEntry"],
  InWarehouse: ["DeliveryOrder"],
};

// Stages that require sales to have been recorded.
const SALES_REQUIRED: ContainerStatus[] = ["PartiallySold", "FullySold"];

export function stageRequirement(stage: ContainerStatus): StageRequirement {
  return {
    docs: STAGE_DOC_REQUIREMENTS[stage] ?? [],
    needsSales: SALES_REQUIRED.includes(stage),
  };
}

function indexOf(status: ContainerStatus): number {
  return CONTAINER_STATUSES.indexOf(status);
}

export interface TransitionCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Can a container move from `from` → `to` given its current context?
 * Forward moves validate the entry criteria of every stage being entered.
 */
export function canTransition(
  from: ContainerStatus,
  to: ContainerStatus,
  ctx: WorkflowContext
): TransitionCheck {
  if (from === to) return { ok: true };

  const fromIdx = indexOf(from);
  const toIdx = indexOf(to);
  if (toIdx === -1 || fromIdx === -1) {
    return { ok: false, reason: "Unknown status" };
  }

  // Backward moves are permitted (corrections) — the API logs them.
  if (toIdx < fromIdx) return { ok: true };

  const present = new Set(ctx.verifiedDocTypes);
  const missing: string[] = [];

  for (let i = fromIdx + 1; i <= toIdx; i++) {
    const stage = CONTAINER_STATUSES[i];
    const req = stageRequirement(stage);
    for (const doc of req.docs) {
      if (!present.has(doc)) {
        missing.push(
          `${DOCUMENT_TYPE_LABELS[doc]} (required for ${CONTAINER_STATUS_LABELS[stage]})`
        );
      }
    }
    if (req.needsSales && !ctx.hasSales) {
      missing.push(`Sales must be recorded for ${CONTAINER_STATUS_LABELS[stage]}`);
    }
    if (stage === "InWarehouse" && !ctx.hasWarehouse) {
      missing.push("A warehouse must be assigned before entering In Warehouse");
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Can't advance — missing: ${missing.join("; ")}`,
    };
  }
  return { ok: true };
}

/** Statuses the container may move to right now (for building the UI). */
export function allowedTransitions(
  from: ContainerStatus,
  ctx: WorkflowContext
): ContainerStatus[] {
  return CONTAINER_STATUSES.filter(
    (s) => s === from || canTransition(from, s, ctx).ok
  );
}
