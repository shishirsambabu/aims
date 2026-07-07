import "server-only";

import type { Prisma } from "@prisma/client";

interface SequenceRow {
  value: number;
}

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  orgId: string,
  scope: string,
  prefix: string,
  width = 4
): Promise<string> {
  const rows = await tx.$queryRaw<SequenceRow[]>`
    INSERT INTO document_sequences (org_id, scope, value)
    VALUES (${orgId}, ${scope}, 1)
    ON CONFLICT (org_id, scope)
    DO UPDATE SET value = document_sequences.value + 1, updated_at = CURRENT_TIMESTAMP
    RETURNING value
  `;
  const value = rows[0]?.value;
  if (!value) throw new Error("DOCUMENT_SEQUENCE_FAILED");
  return `${prefix}-${String(value).padStart(width, "0")}`;
}
