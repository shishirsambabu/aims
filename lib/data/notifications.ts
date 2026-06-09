import "server-only";

import { prisma } from "@/lib/prisma";
import { CONTAINER_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { daysUntil } from "@/lib/utils";
import type { ContainerStatus, DocumentType } from "@/types";

export interface NavCounts {
  expiringDocs: number;
  pendingPayments: number;
  flaggedContainers: number;
  demurrageRisk: number;
  pendingApprovals: number;
  totalAlerts: number;
}

const ZERO: NavCounts = {
  expiringDocs: 0,
  pendingPayments: 0,
  flaggedContainers: 0,
  demurrageRisk: 0,
  pendingApprovals: 0,
  totalAlerts: 0,
};

export type AlertCategory =
  | "demurrage"
  | "docExpiry"
  | "approval"
  | "paymentOverdue"
  | "lossMaking"
  | "flagged";

export type AlertSeverity = "critical" | "warning";

export interface AlertItem {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  subtitle: string;
  href: string;
}

const ACTIVE_STATUSES: ContainerStatus[] = [
  "Booked",
  "InTransit",
  "AtPort",
  "CustomsClearance",
  "Cleared",
  "InWarehouse",
];

/** Counts for sidebar / bell badges. Safe-fails to zeros. */
export async function getNavCounts(orgId: string): Promise<NavCounts> {
  try {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const now = new Date();

    const [
      expiringDocs,
      pendingPayments,
      flaggedContainers,
      demurrageRisk,
      pendingApprovals,
    ] = await Promise.all([
      prisma.document.count({
        where: { orgId, expiryDate: { not: null, lte: in30 } },
      }),
      prisma.payment.count({ where: { orgId, status: { not: "Paid" } } }),
      prisma.container.count({ where: { orgId, flagged: true } }),
      prisma.container.count({
        where: {
          orgId,
          lastFreeDate: { not: null, lte: in7 },
          status: { in: ACTIVE_STATUSES },
        },
      }),
      prisma.payment.count({
        where: { orgId, approvalStatus: "PendingApproval" },
      }),
    ]);

    void now;
    const totalAlerts =
      expiringDocs + flaggedContainers + demurrageRisk + pendingApprovals;
    return {
      expiringDocs,
      pendingPayments,
      flaggedContainers,
      demurrageRisk,
      pendingApprovals,
      totalAlerts,
    };
  } catch {
    return ZERO;
  }
}

/** Full alert feed for the Alerts page, grouped by category. */
export async function getAlerts(orgId: string): Promise<AlertItem[]> {
  try {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const now = new Date();

    const [demurrage, docs, approvals, overdue, lossMaking, flagged] =
      await Promise.all([
        prisma.container.findMany({
          where: {
            orgId,
            lastFreeDate: { not: null, lte: in7 },
            status: { in: ACTIVE_STATUSES },
          },
          select: {
            id: true,
            containerNo: true,
            status: true,
            lastFreeDate: true,
          },
        }),
        prisma.document.findMany({
          where: { orgId, expiryDate: { not: null, lte: in30 } },
          select: {
            id: true,
            type: true,
            containerId: true,
            containerNo: true,
            expiryDate: true,
          },
        }),
        prisma.payment.findMany({
          where: { orgId, approvalStatus: "PendingApproval" },
          select: {
            id: true,
            containerId: true,
            amountRequested: true,
            currency: true,
            container: { select: { containerNo: true } },
          },
        }),
        prisma.payment.findMany({
          where: { orgId, status: { not: "Paid" }, dueDate: { lt: now } },
          select: {
            id: true,
            containerId: true,
            currency: true,
            amountRequested: true,
            dueDate: true,
            container: { select: { containerNo: true } },
          },
        }),
        prisma.sale.findMany({
          where: { orgId, marginPct: { lt: 0 } },
          select: {
            id: true,
            containerId: true,
            marginPct: true,
            container: { select: { containerNo: true } },
          },
        }),
        prisma.container.findMany({
          where: { orgId, flagged: true },
          select: { id: true, containerNo: true },
        }),
      ]);

    const alerts: AlertItem[] = [];

    for (const c of demurrage) {
      const d = daysUntil(c.lastFreeDate);
      alerts.push({
        id: `dem-${c.id}`,
        category: "demurrage",
        severity: d !== null && d < 0 ? "critical" : "warning",
        title: `${c.containerNo} — ${
          d !== null && d < 0
            ? `${Math.abs(d)}d overdue (charges accruing)`
            : `${d}d of free time left`
        }`,
        subtitle: `${CONTAINER_STATUS_LABELS[c.status as ContainerStatus]} · free-day deadline`,
        href: `/containers/${c.id}`,
      });
    }
    for (const d of docs) {
      const days = daysUntil(d.expiryDate);
      alerts.push({
        id: `doc-${d.id}`,
        category: "docExpiry",
        severity: days !== null && days <= 7 ? "critical" : "warning",
        title: `${DOCUMENT_TYPE_LABELS[d.type as DocumentType]} — ${d.containerNo ?? ""}`,
        subtitle:
          days !== null && days < 0
            ? "Expired"
            : `Expires in ${days} day${days === 1 ? "" : "s"}`,
        href: `/containers/${d.containerId}`,
      });
    }
    for (const p of approvals) {
      alerts.push({
        id: `appr-${p.id}`,
        category: "approval",
        severity: "warning",
        title: `Payment awaiting approval — ${p.container?.containerNo ?? ""}`,
        subtitle: `${p.currency} ${Number(p.amountRequested).toLocaleString()}`,
        href: `/payments`,
      });
    }
    for (const p of overdue) {
      alerts.push({
        id: `over-${p.id}`,
        category: "paymentOverdue",
        severity: "critical",
        title: `Overdue payment — ${p.container?.containerNo ?? ""}`,
        subtitle: `${p.currency} ${Number(p.amountRequested).toLocaleString()} · due passed`,
        href: `/payments`,
      });
    }
    for (const s of lossMaking) {
      alerts.push({
        id: `loss-${s.id}`,
        category: "lossMaking",
        severity: "critical",
        title: `Loss-making — ${s.container?.containerNo ?? ""}`,
        subtitle: `Margin ${Number(s.marginPct).toFixed(1)}%`,
        href: `/containers/${s.containerId}`,
      });
    }
    for (const c of flagged) {
      alerts.push({
        id: `flag-${c.id}`,
        category: "flagged",
        severity: "warning",
        title: `Flagged container — ${c.containerNo}`,
        subtitle: "Marked for review",
        href: `/containers/${c.id}`,
      });
    }

    // Critical first.
    return alerts.sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1
    );
  } catch {
    return [];
  }
}
