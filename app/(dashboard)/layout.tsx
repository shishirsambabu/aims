import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { getSessionContext } from "@/lib/auth";
import { getPersonalNavCounts, type NavCounts } from "@/lib/data/notifications";
import { isFeatureEnabled, MAINTENANCE_FLAG } from "@/lib/feature-flags";
import { normalizeRole } from "@/lib/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should already gate this, but guard against direct render.
  if (!user) redirect("/login");

  // Display profile is sourced from the DB-backed session context when
  // available so role changes take effect immediately.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const ctx = await getSessionContext();
  const profile = {
    email: user.email ?? "",
    fullName: ctx?.fullName ?? (meta.full_name as string) ?? null,
    role: ctx?.role ?? normalizeRole(meta.role as string) ?? "viewer",
  };

  // Notification badge counts (safe-fails to zeros if the DB is unreachable).
  let counts: NavCounts = {
    expiringDocs: 0,
    pendingPayments: 0,
    flaggedContainers: 0,
    demurrageRisk: 0,
    pendingApprovals: 0,
    arrivalPrompts: 0,
    totalAlerts: 0,
  };
  let maintenance = false;
  if (ctx) {
    [counts, maintenance] = await Promise.all([
      getPersonalNavCounts(ctx),
      isFeatureEnabled(ctx.orgId, MAINTENANCE_FLAG),
    ]);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-transparent">
      <Sidebar counts={counts} role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav user={profile} />
        {maintenance && (
          <div className="flex items-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-[13px] font-medium text-[#7A4D0E]">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Maintenance in progress — new entries may be interrupted. Check with
            your administrator before starting critical work.
          </div>
        )}
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}
