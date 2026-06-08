import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
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
          <p className="text-sm text-muted-foreground">
            You can view the team. Only admins can change roles.
          </p>
        )}
        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <p className="text-muted-foreground">
              The database isn&apos;t reachable. Set a reachable{" "}
              <code>DATABASE_URL</code> to manage your team.
            </p>
          </div>
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
