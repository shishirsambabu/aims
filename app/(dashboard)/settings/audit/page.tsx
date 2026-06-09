import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listAudit, type AuditEntry } from "@/lib/data/audit";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await requireSession();
  if (!can(session.role, "audit.view")) {
    return (
      <div>
        <PageHeader title="Audit Log" description="Activity trail." />
        <div className="m-6 flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Only admins, managers and auditors can view
          the audit log.
        </div>
      </div>
    );
  }

  let rows: AuditEntry[] = [];
  let loadError = false;
  try {
    rows = await listAudit(session.orgId);
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable trail of every change — who did what, and when."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        {loadError ? (
          <p className="text-sm text-muted-foreground">
            The database isn&apos;t reachable.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No activity recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-financial text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.user ?? "System"}</TableCell>
                      <TableCell>
                        <span className="font-financial rounded-full bg-surface-alt px-2 py-0.5 text-xs">
                          {r.action}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {r.entityType}
                      </TableCell>
                      <TableCell className="text-sm">{r.summary ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
