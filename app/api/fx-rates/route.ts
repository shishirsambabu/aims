import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/observability";

const currencySchema = z.enum(["USD", "AED", "INR"]);

const fxRateSchema = z.object({
  rateDate: z.coerce.date(),
  fromCurrency: currencySchema,
  toCurrency: currencySchema,
  rate: z.coerce.number().positive(),
  source: z.string().min(2).max(80).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "financials.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("fromCurrency") ?? undefined;
    const to = url.searchParams.get("toCurrency") ?? undefined;

    const rates = await prisma.fxRate.findMany({
      where: {
        orgId: session.orgId,
        ...(from ? { fromCurrency: from as never } : {}),
        ...(to ? { toCurrency: to as never } : {}),
      },
      orderBy: [{ rateDate: "desc" }, { updatedAt: "desc" }],
      take: 120,
    });

    return NextResponse.json({ data: rates });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "fx-rates", method: "GET" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "journal.post") && !can(session.role, "finance.close")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = fxRateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    if (input.fromCurrency === input.toCurrency) {
      return NextResponse.json({ error: "Currency pair must be different" }, { status: 422 });
    }

    const rate = await prisma.fxRate.upsert({
      where: {
        orgId_rateDate_fromCurrency_toCurrency: {
          orgId: session.orgId,
          rateDate: input.rateDate,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
        },
      },
      create: {
        orgId: session.orgId,
        rateDate: input.rateDate,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        rate: input.rate,
        source: input.source ?? "Manual",
      },
      update: {
        rate: input.rate,
        source: input.source ?? "Manual",
      },
    });

    return NextResponse.json({ data: rate }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "fx-rates", method: "POST" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
