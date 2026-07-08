import "server-only";

import { prisma } from "@/lib/prisma";
import { startOfTodayIst } from "@/lib/dates";
import { reportError } from "@/lib/observability";

/**
 * Daily FX snapshot: fetches USD→INR and AED→INR from a free, key-less API
 * and upserts today's rates for every org. Idempotent per day. Failures are
 * reported but never fail the calling job — yesterday's rates stay in force.
 */
export async function fetchDailyFxRates(): Promise<{ upserted: number }> {
  let upserted = 0;
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`FX API responded ${response.status}`);
    const body = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    const inrPerUsd = body.rates?.INR;
    const aedPerUsd = body.rates?.AED;
    if (body.result !== "success" || !inrPerUsd || !aedPerUsd) {
      throw new Error("FX API returned no usable INR/AED rates");
    }
    const inrPerAed = inrPerUsd / aedPerUsd;

    const rateDate = startOfTodayIst();
    const orgs = await prisma.organization.findMany({ select: { id: true } });

    for (const org of orgs) {
      const pairs = [
        { fromCurrency: "USD" as const, toCurrency: "INR" as const, rate: inrPerUsd },
        { fromCurrency: "AED" as const, toCurrency: "INR" as const, rate: inrPerAed },
      ];
      for (const pair of pairs) {
        await prisma.fxRate.upsert({
          where: {
            orgId_rateDate_fromCurrency_toCurrency: {
              orgId: org.id,
              rateDate,
              fromCurrency: pair.fromCurrency,
              toCurrency: pair.toCurrency,
            },
          },
          create: {
            orgId: org.id,
            rateDate,
            fromCurrency: pair.fromCurrency,
            toCurrency: pair.toCurrency,
            rate: pair.rate,
            source: "open.er-api.com",
          },
          update: { rate: pair.rate, source: "open.er-api.com" },
        });
        upserted += 1;
      }
    }
  } catch (error) {
    await reportError(error, { job: "fx-rates" });
  }
  return { upserted };
}

/** Latest stored rate for a currency pair, or null when none exists yet. */
export async function getLatestRate(
  orgId: string,
  fromCurrency: "USD" | "AED",
  toCurrency: "INR" = "INR"
): Promise<number | null> {
  const row = await prisma.fxRate.findFirst({
    where: { orgId, fromCurrency, toCurrency },
    orderBy: { rateDate: "desc" },
    select: { rate: true },
  });
  return row ? Number(row.rate) : null;
}
