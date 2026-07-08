import "server-only";

import { NextResponse, type NextRequest } from "next/server";

/**
 * Fail-closed authentication for scheduled job endpoints.
 *
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically when
 * the CRON_SECRET env var is set. Earlier versions of these routes skipped
 * the check when the env var was missing, which left the endpoints publicly
 * triggerable — now an unset secret refuses to run at all.
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; scheduled jobs are disabled." },
      { status: 503 }
    );
  }
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  return null;
}
