import { NextResponse, type NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/cron-auth";
import { processEmailOutbox } from "@/lib/email/outbox";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  try {
    const result = await processEmailOutbox(25);
    return NextResponse.json({ status: "ok", result });
  } catch (error) {
    await reportError(error, { route: "/api/jobs/email-outbox" });
    return NextResponse.json({ error: "Email outbox failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
