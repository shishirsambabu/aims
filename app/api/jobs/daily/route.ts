import { NextResponse, type NextRequest } from "next/server";

import { processEmailOutbox } from "@/lib/email/outbox";
import { reportError } from "@/lib/observability";
import { releaseExpiredReservations } from "@/lib/reservations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (expected && provided !== expected) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  try {
    const [releasedReservations, emailOutbox] = await Promise.all([
      releaseExpiredReservations(),
      processEmailOutbox(100),
    ]);

    return NextResponse.json({
      status: "ok",
      releasedReservations,
      emailOutbox,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    await reportError(error, { route: "/api/jobs/daily" });
    return NextResponse.json({ error: "Daily jobs failed" }, { status: 500 });
  }
}
