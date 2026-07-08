import { NextResponse, type NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/cron-auth";
import { sendDailyAlertDigests } from "@/lib/email/notify";
import { processEmailOutbox } from "@/lib/email/outbox";
import { fetchDailyFxRates } from "@/lib/fx";
import { reportError } from "@/lib/observability";
import { releaseExpiredReservations } from "@/lib/reservations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  try {
    const releasedReservations = await releaseExpiredReservations();
    const fxRates = await fetchDailyFxRates();
    // Digests enqueue first so the drain below delivers them in the same run.
    const alertDigests = await sendDailyAlertDigests();
    const emailOutbox = await processEmailOutbox(100);

    return NextResponse.json({
      status: "ok",
      releasedReservations,
      fxRates,
      alertDigests,
      emailOutbox,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    await reportError(error, { route: "/api/jobs/daily" });
    return NextResponse.json({ error: "Daily jobs failed" }, { status: 500 });
  }
}
