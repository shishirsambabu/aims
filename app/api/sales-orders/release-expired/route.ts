import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { reportError } from "@/lib/observability";
import { can } from "@/lib/permissions";
import { releaseExpiredReservations } from "@/lib/reservations";

export async function GET(request: NextRequest) {
  try {
    const configuredSecret = process.env.CRON_SECRET;
    const bearer = request.headers.get("authorization");
    if (configuredSecret && bearer === `Bearer ${configuredSecret}`) {
      const released = await releaseExpiredReservations();
      return NextResponse.json({ ok: true, released });
    }

    const session = await requireSession();
    if (!can(session.role, "salesorder.approve")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const released = await releaseExpiredReservations(session.orgId);
    return NextResponse.json({ ok: true, released });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(error, { route: "sales-orders/release-expired" });
    return NextResponse.json({ error: "Unable to release expired reservations" }, { status: 500 });
  }
}
