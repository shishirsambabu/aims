import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should already gate this, but guard against direct render.
  if (!user) redirect("/login");

  // Display profile is sourced from auth metadata; the DB profile (role,
  // org) is wired in once the database is reachable (see PROGRESS blockers).
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const profile = {
    email: user.email ?? "",
    fullName: (meta.full_name as string) ?? null,
    role: (meta.role as string) ?? "viewer",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-alt">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav user={profile} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}
