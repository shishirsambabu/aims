import Link from "next/link";
import { ArrowLeft, Info, WifiOff } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamTable, type TeamMember } from "@/components/settings/TeamTable";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireSession();
  const canManage = session.role === "admin";

  let members: TeamMember[] = [];
  let loadError = false;
  try {
    const rows = await prisma.user.findMany({
      where: { orgId: session.orgId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });
    members = rows as TeamMember[];
  } catch (err) {
    console.error("[settings/team] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Team Management"
        description="Members and roles. Admins can change roles; viewers are read-only."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        {!canManage && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 text-primary" />
            You can view the team. Only admins can change roles.
          </div>
        )}
        {loadError ? (
          <EmptyState
            icon={WifiOff}
            title="Team could not load"
            description="The database is not reachable. Set a reachable DATABASE_URL to manage your team."
          />
        ) : (
          <TeamTable
            members={members}
            currentUserId={session.userId}
            canManage={canManage}
          />
        )}
      </div>
    </div>
  );
}
