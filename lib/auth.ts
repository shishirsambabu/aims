import "server-only";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/types";
import { normalizeRole } from "@/lib/permissions";

// Single-tenant default for this internal deployment. New auth identities are
// attached to this organisation on first sign-in.
export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
export const DEFAULT_ORG_NAME = "Aeden Fruits International Pvt Ltd";

export interface SessionContext {
  userId: string;
  authId: string;
  orgId: string;
  email: string;
  fullName: string | null;
  role: Role;
}

/**
 * Resolves the current request's user into an app-level session context,
 * provisioning the org + user profile on first access. Returns null when
 * there is no authenticated Supabase user.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    // Access is invite-only. Supabase authentication proves identity, while
    // the application profile is the sole authority for role and organisation.
    const profile = await prisma.user.findUnique({
      where: { authId: user.id },
      select: {
        id: true,
        orgId: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });
    if (!profile) throw new Error("ACCESS_NOT_PROVISIONED");
    if (!profile.isActive) throw new Error("ACCOUNT_DISABLED");

    return {
      userId: profile.id,
      authId: user.id,
      orgId: profile.orgId,
      email: profile.email,
      fullName: profile.fullName,
      role: normalizeRole(profile.role) ?? profile.role,
    };
  } catch (err) {
    if (err instanceof Error && ["ACCESS_NOT_PROVISIONED", "ACCOUNT_DISABLED"].includes(err.message)) {
      throw err;
    }
    console.error("[auth] Session profile lookup failed", err);
    throw new Error("SESSION_PROFILE_UNAVAILABLE");
  }
}

/** Throws if there is no authenticated session. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}

/** Roles permitted to mutate data. Viewers are read-only. */
export function canWrite(role: Role): boolean {
  return [
    "admin",
    "gm",
    "manager",
    "finance",
    "sales_executive",
    "warehouse",
    "clearing_agent",
  ].includes(role);
}
