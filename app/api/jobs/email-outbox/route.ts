import { NextResponse, type NextRequest } from "next/server";

import { processEmailOutbox } from "@/lib/email/outbox";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (expected && provided !== expected) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

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
