import "server-only";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/types";

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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = (meta.full_name as string) ?? null;
  const metaRole = (meta.role as Role) ?? "viewer";

  // Ensure the default organisation exists.
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: {
      id: DEFAULT_ORG_ID,
      name: DEFAULT_ORG_NAME,
      city: "Kochi",
      country: "India",
    },
  });

  // Find or provision the app user profile for this auth identity.
  const profile = await prisma.user.upsert({
    where: { authId: user.id },
    update: { email: user.email ?? undefined },
    create: {
      authId: user.id,
      orgId: DEFAULT_ORG_ID,
      email: user.email ?? `${user.id}@unknown.local`,
      fullName,
      role: metaRole,
    },
    select: {
      id: true,
      orgId: true,
      email: true,
      fullName: true,
      role: true,
    },
  });

  return {
    userId: profile.id,
    authId: user.id,
    orgId: profile.orgId,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role as Role,
  };
}

/** Throws if there is no authenticated session. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}

/** Roles permitted to mutate data. Viewers are read-only. */
export function canWrite(role: Role): boolean {
  return role === "admin" || role === "manager";
}
