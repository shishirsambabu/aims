import "server-only";

import { prisma } from "@/lib/prisma";
import { CONTAINER_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { daysUntil } from "@/lib/utils";
import type { SessionContext } from "@/lib/auth";
import type { ContainerStatus, DocumentType, Role } from "@/types";

export interface NavCounts {
  expiringDocs: number;
  pendingPayments: number;
  flaggedContainers: number;
  demurrageRisk: number;
  pendingApprovals: number;
  arrivalPrompts: number;
  totalAlerts: number;
}

const ZERO: NavCounts = {
  expiringDocs: 0,
  pendingPayments: 0,
  flaggedContainers: 0,
  demurrageRisk: 0,
  pendingApprovals: 0,
  arrivalPrompts: 0,
  totalAlerts: 0,
};

export type AlertCategory =
  | "arrival"
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
  primaryAction: string;
  ownerRoles: Role[];
  dueLabel?: string;
}

export interface PersonalAlertItem extends AlertItem {
  readAt: Date | null;
  snoozedUntil: Date | null;
  resolvedAt: Date | null;
  isUnread: boolean;
  isSnoozed: boolean;
}

export interface AlertPreference {
  category: AlertCategory;
  enabled: boolean;
  label: string;
}

export interface PersonalAlertSummary {
  active: PersonalAlertItem[];
  snoozed: PersonalAlertItem[];
  resolved: PersonalAlertItem[];
  unreadCount: number;
  criticalCount: number;
  detentionCount: number;
  preferences: AlertPreference[];
}

const ACTIVE_STATUSES: ContainerStatus[] = [
  "Booked",
  "InTransit",
  "AtPort",
  "CustomsClearance",
  "Cleared",
  "InWarehouse",
];

export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  arrival: "Arrival confirmation",
  demurrage: "Detention risk",
  docExpiry: "Document expiry",
  approval: "Payment approvals",
  paymentOverdue: "Overdue payments",
  lossMaking: "Loss-making containers",
  flagged: "Flagged containers",
};

const CATEGORY_ROLES: Record<AlertCategory, Role[]> = {
  arrival: ["admin", "manager", "clearing_agent"],
  demurrage: ["admin", "manager", "clearing_agent", "finance"],
  docExpiry: ["admin", "manager", "clearing_agent"],
  approval: ["admin", "manager", "finance"],
  paymentOverdue: ["admin", "manager", "finance"],
  lossMaking: ["admin", "manager", "finance", "auditor"],
  flagged: ["admin", "manager", "auditor"],
};

const CATEGORY_ACTIONS: Record<AlertCategory, string> = {
  arrival: "Set ATA",
  demurrage: "Clear free-day risk",
  docExpiry: "Review document",
  approval: "Approve payment",
  paymentOverdue: "Record payment",
  lossMaking: "Review margin",
  flagged: "Review flag",
};

export function roleCanSeeAlert(role: Role, category: AlertCategory): boolean {
  if (role === "viewer") return false;
  return CATEGORY_ROLES[category].includes(role);
}

function visibleForRole<T extends AlertItem>(alerts: T[], role: Role): T[] {
  return alerts.filter((a) => roleCanSeeAlert(role, a.category));
}

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
      arrivalPrompts,
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
      prisma.container.count({
        where: {
          orgId,
          deletedAt: null,
          ata: null,
          eta: { not: null, lte: now },
          status: { in: ACTIVE_STATUSES },
        },
      }),
    ]);

    const totalAlerts =
      expiringDocs + flaggedContainers + demurrageRisk + pendingApprovals + arrivalPrompts;
    return {
      expiringDocs,
      pendingPayments,
      flaggedContainers,
      demurrageRisk,
      pendingApprovals,
      arrivalPrompts,
      totalAlerts,
    };
  } catch {
    return ZERO;
  }
}

export async function getPersonalNavCounts(
  session: Pick<SessionContext, "orgId" | "userId" | "role">
): Promise<NavCounts> {
  try {
    const personal = await getPersonalAlerts(session);
    const active = personal.active;
    return {
      expiringDocs: active.filter((a) => a.category === "docExpiry").length,
      pendingPayments: active.filter(
        (a) => a.category === "paymentOverdue" || a.category === "approval"
      ).length,
      flaggedContainers: active.filter((a) => a.category === "flagged").length,
      demurrageRisk: active.filter((a) => a.category === "demurrage").length,
      pendingApprovals: active.filter((a) => a.category === "approval").length,
      arrivalPrompts: active.filter((a) => a.category === "arrival").length,
      totalAlerts: active.length,
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

    const [arrivals, demurrage, docs, approvals, overdue, lossMaking, flagged] =
      await Promise.all([
        prisma.container.findMany({
          where: {
            orgId,
            deletedAt: null,
            ata: null,
            eta: { not: null, lte: now },
            status: { in: ACTIVE_STATUSES },
          },
          select: { id: true, containerNo: true, eta: true, status: true },
          take: 50,
        }),
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

    for (const c of arrivals) {
      const d = daysUntil(c.eta);
      alerts.push({
        id: `arr-${c.id}`,
        category: "arrival",
        severity: d !== null && d < 0 ? "critical" : "warning",
        title: `${c.containerNo} - confirm arrival?`,
        subtitle:
          d !== null && d < 0
            ? `ETA was ${Math.abs(d)}d ago - set ATA`
            : "ETA today - mark arrived to set ATA",
        href: `/containers/${c.id}`,
        primaryAction: CATEGORY_ACTIONS.arrival,
        ownerRoles: CATEGORY_ROLES.arrival,
        dueLabel: d !== null && d < 0 ? "Overdue" : "Today",
      });
    }

    for (const c of demurrage) {
      const d = daysUntil(c.lastFreeDate);
      alerts.push({
        id: `dem-${c.id}`,
        category: "demurrage",
        severity: d !== null && d < 0 ? "critical" : "warning",
        title: `${c.containerNo} - ${
          d !== null && d < 0
            ? `${Math.abs(d)}d overdue (charges accruing)`
            : `${d}d of free time left`
        }`,
        subtitle: `${CONTAINER_STATUS_LABELS[c.status as ContainerStatus]} - free-day deadline`,
        href: `/containers/${c.id}`,
        primaryAction: CATEGORY_ACTIONS.demurrage,
        ownerRoles: CATEGORY_ROLES.demurrage,
        dueLabel: d !== null && d < 0 ? "Charges accruing" : `${d}d left`,
      });
    }

    for (const d of docs) {
      const days = daysUntil(d.expiryDate);
      alerts.push({
        id: `doc-${d.id}`,
        category: "docExpiry",
        severity: days !== null && days <= 7 ? "critical" : "warning",
        title: `${DOCUMENT_TYPE_LABELS[d.type as DocumentType]} - ${d.containerNo ?? ""}`,
        subtitle:
          days !== null && days < 0
            ? "Expired"
            : `Expires in ${days} day${days === 1 ? "" : "s"}`,
        href: `/containers/${d.containerId}`,
        primaryAction: CATEGORY_ACTIONS.docExpiry,
        ownerRoles: CATEGORY_ROLES.docExpiry,
        dueLabel: days !== null && days < 0 ? "Expired" : `${days}d`,
      });
    }

    for (const p of approvals) {
      alerts.push({
        id: `appr-${p.id}`,
        category: "approval",
        severity: "warning",
        title: `Payment awaiting approval - ${p.container?.containerNo ?? ""}`,
        subtitle: `${p.currency} ${Number(p.amountRequested).toLocaleString()}`,
        href: "/payments",
        primaryAction: CATEGORY_ACTIONS.approval,
        ownerRoles: CATEGORY_ROLES.approval,
        dueLabel: "Pending",
      });
    }

    for (const p of overdue) {
      alerts.push({
        id: `over-${p.id}`,
        category: "paymentOverdue",
        severity: "critical",
        title: `Overdue payment - ${p.container?.containerNo ?? ""}`,
        subtitle: `${p.currency} ${Number(p.amountRequested).toLocaleString()} - due passed`,
        href: "/payments",
        primaryAction: CATEGORY_ACTIONS.paymentOverdue,
        ownerRoles: CATEGORY_ROLES.paymentOverdue,
        dueLabel: "Overdue",
      });
    }

    for (const s of lossMaking) {
      alerts.push({
        id: `loss-${s.id}`,
        category: "lossMaking",
        severity: "critical",
        title: `Loss-making - ${s.container?.containerNo ?? ""}`,
        subtitle: `Margin ${Number(s.marginPct).toFixed(1)}%`,
        href: `/containers/${s.containerId}`,
        primaryAction: CATEGORY_ACTIONS.lossMaking,
        ownerRoles: CATEGORY_ROLES.lossMaking,
        dueLabel: "Review",
      });
    }

    for (const c of flagged) {
      alerts.push({
        id: `flag-${c.id}`,
        category: "flagged",
        severity: "warning",
        title: `Flagged container - ${c.containerNo}`,
        subtitle: "Marked for review",
        href: `/containers/${c.id}`,
        primaryAction: CATEGORY_ACTIONS.flagged,
        ownerRoles: CATEGORY_ROLES.flagged,
        dueLabel: "Review",
      });
    }

    return alerts.sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1
    );
  } catch {
    return [];
  }
}

export async function getAlertPreferences(
  orgId: string,
  userId: string
): Promise<AlertPreference[]> {
  const rows = await prisma.userAlertPreference.findMany({
    where: { orgId, userId },
    select: { category: true, enabled: true },
  });
  const byCategory = new Map(rows.map((r) => [r.category, r.enabled]));
  return (Object.keys(ALERT_CATEGORY_LABELS) as AlertCategory[]).map((category) => ({
    category,
    enabled: byCategory.get(category) ?? true,
    label: ALERT_CATEGORY_LABELS[category],
  }));
}

export async function getPersonalAlerts(
  session: Pick<SessionContext, "orgId" | "userId" | "role">
): Promise<PersonalAlertSummary> {
  const [allAlerts, preferences] = await Promise.all([
    getAlerts(session.orgId),
    getAlertPreferences(session.orgId, session.userId),
  ]);

  const enabledCategories = new Set(
    preferences.filter((p) => p.enabled).map((p) => p.category)
  );
  const visibleAlerts = visibleForRole(
    allAlerts.filter((a) => enabledCategories.has(a.category)),
    session.role
  );

  const states = await prisma.userAlertState.findMany({
    where: {
      orgId: session.orgId,
      userId: session.userId,
      alertKey: { in: visibleAlerts.map((a) => a.id) },
    },
    select: {
      alertKey: true,
      readAt: true,
      snoozedUntil: true,
      resolvedAt: true,
    },
  });
  const stateByKey = new Map(states.map((s) => [s.alertKey, s]));
  const now = new Date();

  const personal = visibleAlerts.map((a): PersonalAlertItem => {
    const state = stateByKey.get(a.id);
    const snoozedUntil = state?.snoozedUntil ?? null;
    const resolvedAt = state?.resolvedAt ?? null;
    return {
      ...a,
      readAt: state?.readAt ?? null,
      snoozedUntil,
      resolvedAt,
      isUnread: !state?.readAt,
      isSnoozed: Boolean(snoozedUntil && snoozedUntil > now),
    };
  });

  const active = personal.filter((a) => !a.resolvedAt && !a.isSnoozed);
  const snoozed = personal.filter((a) => !a.resolvedAt && a.isSnoozed);
  const resolved = personal.filter((a) => Boolean(a.resolvedAt));

  return {
    active,
    snoozed,
    resolved,
    unreadCount: active.filter((a) => a.isUnread).length,
    criticalCount: active.filter((a) => a.severity === "critical").length,
    detentionCount: active.filter((a) => a.category === "demurrage").length,
    preferences,
  };
}
