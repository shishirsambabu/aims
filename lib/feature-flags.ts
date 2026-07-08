import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Org-scoped feature flags / kill switches (D3 in DEEP_GAPS_AUDIT).
 * Reads are cached briefly so flag checks are safe on hot paths; writes go
 * through the admin API which invalidates the cache.
 */

export const MAINTENANCE_FLAG = "maintenance_mode";

const FLAGS_TTL_MS = 30_000;
const flagsCache = new Map<string, { at: number; value: Promise<Record<string, boolean>> }>();

export function invalidateFeatureFlags(orgId?: string) {
  if (!orgId) flagsCache.clear();
  else flagsCache.delete(orgId);
}

export async function getFeatureFlags(orgId: string): Promise<Record<string, boolean>> {
  const hit = flagsCache.get(orgId);
  const now = Date.now();
  if (hit && now - hit.at < FLAGS_TTL_MS) return hit.value;

  const value = (async () => {
    try {
      const rows = await prisma.featureFlag.findMany({
        where: { orgId },
        select: { key: true, enabled: true },
      });
      return Object.fromEntries(rows.map((row: { key: string; enabled: boolean }) => [row.key, row.enabled]));
    } catch {
      // Fail open with "no flags" — a DB hiccup must not block the app shell.
      flagsCache.delete(orgId);
      return {};
    }
  })();
  flagsCache.set(orgId, { at: now, value });
  return value;
}

export async function isFeatureEnabled(orgId: string, key: string): Promise<boolean> {
  const flags = await getFeatureFlags(orgId);
  return flags[key] === true;
}
