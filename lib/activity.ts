import "server-only";

import { prisma } from "@/lib/prisma";

interface LogInput {
  orgId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Appends an audit-trail entry. Failures are swallowed so logging never breaks
 * the primary mutation.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        orgId: input.orgId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata as object | undefined,
      },
    });
  } catch (err) {
    console.error("[activity] failed to write log entry", err);
  }
}
