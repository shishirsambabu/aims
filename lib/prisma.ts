import { PrismaClient } from "@prisma/client";

import { reportSlowOperation } from "@/lib/monitoring";

// Prevent multiple Prisma instances during Next.js hot-reload in development.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const queryLoggingEnabled = process.env.AIMS_LOG_QUERIES === "1";

function databaseUrlWithServerlessPoolLimits(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT ?? "1");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", process.env.PRISMA_POOL_TIMEOUT ?? "20");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const datasourceUrl = databaseUrlWithServerlessPoolLimits();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: queryLoggingEnabled
      ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
        ]
      : process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (queryLoggingEnabled) {
  (
    prisma as PrismaClient & {
      $on(event: "query", callback: (event: { query: string; duration: number }) => void): void;
    }
  ).$on("query", (event) => {
    reportSlowOperation("prisma.query", event.duration, {
      query: event.query,
    });
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
