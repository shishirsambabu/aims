import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/types";
import { normalizeRole } from "@/lib/permissions";
import { reportError } from "@/lib/observability";

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
  mfaRequired: boolean;
  mfaVerified: boolean;
}

const MFA_ROLES = new Set<Role>(["admin", "gm", "finance"]);

function shouldEnforceMfa(): boolean {
  return process.env.ENFORCE_MFA === "true" || process.env.NEXT_PUBLIC_ENFORCE_MFA === "true";
}

function roleRequiresMfa(role: Role): boolean {
  return MFA_ROLES.has(role);
}

/**
 * Resolves the current request's user into an app-level session context,
 * provisioning the org + user profile on first access. Returns null when
 * there is no authenticated Supabase user.
 *
 * Wrapped in React cache() so layout + page (and nested data calls) share a
 * single profile lookup per request. The cache is per-request only, so
 * isActive/role/MFA changes still take effect on the next request.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
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

    const role = normalizeRole(profile.role) ?? profile.role;
    const mfaRequired = shouldEnforceMfa() && roleRequiresMfa(role);
    let mfaVerified = !mfaRequired;
    if (mfaRequired) {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const currentLevel = assurance.data?.currentLevel ?? null;
      mfaVerified = currentLevel === "aal2";
      if (!mfaVerified) throw new Error("MFA_REQUIRED");
    }

    return {
      userId: profile.id,
      authId: user.id,
      orgId: profile.orgId,
      email: profile.email,
      fullName: profile.fullName,
      role,
      mfaRequired,
      mfaVerified,
    };
  } catch (err) {
    if (err instanceof Error && ["ACCESS_NOT_PROVISIONED", "ACCOUNT_DISABLED", "MFA_REQUIRED"].includes(err.message)) {
      throw err;
    }
    await reportError(err, { area: "auth", action: "session_profile_lookup" });
    throw new Error("SESSION_PROFILE_UNAVAILABLE");
  }
});

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
