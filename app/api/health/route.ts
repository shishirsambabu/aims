import { NextResponse } from "next/server";

import { reportError } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "reachable",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    await reportError(error, { route: "health", check: "database" });
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
