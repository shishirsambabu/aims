import "server-only";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Duplicate-submission guard (B1 in DEEP_GAPS_AUDIT).
 *
 * The client sends a per-form-submission `Idempotency-Key` header. The first
 * request inserts the key (unique on org+scope+key) and stores its response;
 * any retry with the same key gets the stored response back instead of
 * creating a second payment/receipt/order.
 *
 * Usage in a route:
 *   const replay = await findIdempotentReplay(session, "payments.create", key);
 *   if (replay) return replay;
 *   ...perform the mutation...
 *   await storeIdempotentResult(session, "payments.create", key, 201, body);
 */

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function readIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key");
  if (!key || !KEY_PATTERN.test(key)) return null;
  return key;
}

export async function findIdempotentReplay(
  session: { orgId: string },
  scope: string,
  key: string | null
): Promise<NextResponse | null> {
  if (!key) return null;
  const existing = await prisma.idempotencyKey.findUnique({
    where: { orgId_scope_key: { orgId: session.orgId, scope, key } },
    select: { responseStatus: true, responseBody: true },
  });
  if (!existing) return null;
  return NextResponse.json(
    (existing.responseBody as object | null) ?? { replayed: true },
    { status: existing.responseStatus ?? 200, headers: { "Idempotent-Replay": "true" } }
  );
}

export async function storeIdempotentResult(
  session: { orgId: string; userId: string },
  scope: string,
  key: string | null,
  responseStatus: number,
  responseBody: unknown
): Promise<void> {
  if (!key) return;
  try {
    await prisma.idempotencyKey.create({
      data: {
        orgId: session.orgId,
        userId: session.userId,
        scope,
        key,
        responseStatus,
        responseBody: responseBody as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // A concurrent duplicate insert means the other request won the race —
    // its stored response will serve future retries. Never fail the mutation.
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
    ) {
      console.error("[idempotency] failed to store key", err);
    }
  }
}
