import { NextResponse, type NextRequest } from "next/server";

import {
  ColdChainError,
  getColdChainWorkspace,
  recordColdRoomReading,
  updateTemperatureTask,
} from "@/lib/data/cold-chain";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { coldRoomReadingSchema, temperatureTaskActionSchema } from "@/lib/validations/cold-chain";

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "inventory.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const data = await getColdChainWorkspace(session.orgId);
    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err, "[api/cold-chain GET]");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "coldchain.manage")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const body = await request.json();
    if (body.kind === "reading") {
      const parsed = coldRoomReadingSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: parsed.error.flatten() },
          { status: 422 }
        );
      }
      const data = await recordColdRoomReading(session.orgId, session.userId, parsed.data);
      return NextResponse.json({ data }, { status: 201 });
    }
    if (body.kind === "task-action") {
      const parsed = temperatureTaskActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: parsed.error.flatten() },
          { status: 422 }
        );
      }
      const data = await updateTemperatureTask(session.orgId, session.userId, parsed.data);
      return NextResponse.json({ data });
    }
    return NextResponse.json({ error: "Invalid cold-chain action" }, { status: 422 });
  } catch (err) {
    return handleError(err, "[api/cold-chain POST]");
  }
}

function handleError(err: unknown, label: string) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof ColdChainError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(label, err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
