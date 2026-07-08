import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/observability";

type DbClient = typeof prisma | Prisma.TransactionClient;

export interface EnqueueEmailInput {
  orgId: string;
  toEmail: string | null | undefined;
  ccEmail?: string | null;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  category: string;
  scheduledAt?: Date;
}

export async function enqueueEmail(db: DbClient, input: EnqueueEmailInput) {
  const toEmail = input.toEmail?.trim();
  if (!toEmail) return null;
  return db.emailOutbox.create({
    data: {
      orgId: input.orgId,
      toEmail,
      ccEmail: input.ccEmail?.trim() || null,
      subject: input.subject,
      textBody: input.textBody ?? null,
      htmlBody: input.htmlBody ?? null,
      category: input.category,
      scheduledAt: input.scheduledAt ?? new Date(),
    },
  });
}

async function sendWithResend(input: {
  toEmail: string;
  ccEmail: string | null;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "AIMS ERP <noreply@aedenfruits.com>";
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.toEmail],
      cc: input.ccEmail ? [input.ccEmail] : undefined,
      subject: input.subject,
      text: input.textBody ?? undefined,
      html: input.htmlBody ?? undefined,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message ?? `Resend failed with ${response.status}`);
  }
  return String(payload.id ?? "");
}

export async function processEmailOutbox(limit = 25) {
  const rows = await prisma.emailOutbox.findMany({
    where: {
      status: { in: ["Pending", "Retry"] },
      scheduledAt: { lte: new Date() },
      attempts: { lt: 5 },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const result = { picked: rows.length, sent: 0, failed: 0 };

  for (const row of rows) {
    try {
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: "Sending", attempts: { increment: 1 }, lastError: null },
      });
      const providerId = await sendWithResend({
        toEmail: row.toEmail,
        ccEmail: row.ccEmail,
        subject: row.subject,
        textBody: row.textBody,
        htmlBody: row.htmlBody,
      });
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: "Sent",
          provider: "resend",
          providerId,
          sentAt: new Date(),
        },
      });
      result.sent += 1;
    } catch (error) {
      const nextStatus = row.attempts + 1 >= 5 ? "Failed" : "Retry";
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: nextStatus,
          lastError: error instanceof Error ? error.message : String(error),
          scheduledAt: new Date(Date.now() + Math.min(60, 2 ** row.attempts) * 60_000),
        },
      });
      await reportError(error, { job: "email-outbox", emailOutboxId: row.id });
      result.failed += 1;
    }
  }

  return result;
}
