import "server-only";

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/email/outbox";
import { getPersonalAlerts } from "@/lib/data/notifications";
import { normalizeRole, can, ALL_ROLES } from "@/lib/permissions";
import { reportError } from "@/lib/observability";
import type { Role } from "@/types";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

const APPROVER_ROLES = ALL_ROLES.filter((role) => can(role, "payment.approve"));

/**
 * Emails every active approver (except the maker) when a payment request
 * enters PendingApproval. Fire-and-forget: notification failures must never
 * fail the payment mutation.
 */
export async function notifyPaymentApprovalRequested(input: {
  orgId: string;
  requestedById: string;
  containerNo: string;
  currency: string;
  amount: number;
  supplierName?: string | null;
}): Promise<void> {
  try {
    const approvers = await prisma.user.findMany({
      where: {
        orgId: input.orgId,
        isActive: true,
        role: { in: APPROVER_ROLES },
        id: { not: input.requestedById },
      },
      select: { email: true, fullName: true },
    });
    const amountLabel = `${input.currency} ${input.amount.toLocaleString("en-IN")}`;
    for (const approver of approvers) {
      await enqueueEmail(prisma, {
        orgId: input.orgId,
        toEmail: approver.email,
        subject: `Approval needed: payment ${amountLabel} · ${input.containerNo}`,
        textBody: [
          `A payment request needs your approval.`,
          ``,
          `Container: ${input.containerNo}`,
          `Supplier: ${input.supplierName ?? "—"}`,
          `Amount: ${amountLabel}`,
          ``,
          `Review and approve: ${appUrl("/payments")}`,
        ].join("\n"),
        category: "payment-approval",
      });
    }
  } catch (error) {
    await reportError(error, { area: "notify", action: "payment_approval" });
  }
}

/**
 * Daily alert digest: one email per active user who has visible active
 * alerts, listing their top items. Called from the daily cron.
 */
export async function sendDailyAlertDigests(): Promise<{ digests: number }> {
  let digests = 0;
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, orgId: true, email: true, fullName: true, role: true },
  });

  for (const user of users) {
    try {
      const role = (normalizeRole(user.role) ?? user.role) as Role;
      const summary = await getPersonalAlerts({
        orgId: user.orgId,
        userId: user.id,
        role,
      });
      const active = summary.active;
      if (active.length === 0) continue;

      const lines = active
        .slice(0, 10)
        .map((alert) => `• [${alert.severity.toUpperCase()}] ${alert.title} — ${alert.subtitle}`);
      const more = active.length > 10 ? `…and ${active.length - 10} more.` : null;

      await enqueueEmail(prisma, {
        orgId: user.orgId,
        toEmail: user.email,
        subject: `AIMS daily digest: ${active.length} open alert${active.length === 1 ? "" : "s"} (${summary.criticalCount} critical)`,
        textBody: [
          `Good morning${user.fullName ? ` ${user.fullName}` : ""},`,
          ``,
          `Your open alerts in AIMS:`,
          ``,
          ...lines,
          ...(more ? [more] : []),
          ``,
          `Open your alert center: ${appUrl("/alerts")}`,
        ].join("\n"),
        category: "daily-digest",
      });
      digests += 1;
    } catch (error) {
      await reportError(error, {
        area: "notify",
        action: "daily_digest",
        userId: user.id,
      });
    }
  }

  return { digests };
}
