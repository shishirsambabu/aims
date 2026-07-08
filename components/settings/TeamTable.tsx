"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import type { Role } from "@/types";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/permissions";

export interface TeamMember {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  isActive: boolean;
}

const ROLES = ALL_ROLES;

export function TeamTable({
  members,
  currentUserId,
  canManage,
}: {
  members: TeamMember[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function changeRole(id: string, role: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to update role");
        return;
      }
      toast.success("Role updated");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(member: TeamMember, isActive: boolean) {
    if (
      !isActive &&
      !confirm(
        `Deactivate ${member.fullName || member.email}? They lose access on their next request. Reassign their open leads, tasks and approvals to a colleague.`
      )
    ) {
      return;
    }
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to update member");
        return;
      }
      toast.success(isActive ? "Member reactivated" : "Member deactivated");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Member</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const isSelf = m.id === currentUserId;
            return (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {(m.fullName || m.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {m.fullName || "—"}
                      {isSelf && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{m.email}</TableCell>
                <TableCell>
                  {canManage && !isSelf ? (
                    <select
                      value={m.role}
                      disabled={busyId === m.id}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        m.isActive
                          ? "text-xs text-success"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                    {canManage && !isSelf && (
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => setActive(m, !m.isActive)}
                        className="rounded border border-input bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        {m.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
