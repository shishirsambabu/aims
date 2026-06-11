import { PrismaClient } from "@prisma/client";

import { reportSlowOperation } from "@/lib/monitoring";

// Prevent multiple Prisma instances during Next.js hot-reload in development.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const queryLoggingEnabled = process.env.AIMS_LOG_QUERIES === "1";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
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
