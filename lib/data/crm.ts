import "server-only";

import { prisma } from "@/lib/prisma";
import type { CrmLeadStatus, CrmOpportunityStage, CrmTaskStatus } from "@/types";

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function dayKey(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export interface CrmLeadRow {
  id: string;
  leadNo: string;
  name: string;
  companyName: string | null;
  source: string | null;
  status: CrmLeadStatus;
  region: string | null;
  phone: string | null;
  email: string | null;
  interestedIn: string | null;
  nextFollowUpAt: string | null;
  convertedAt: string | null;
  notes: string | null;
  customerId: string | null;
  ownerId: string | null;
}

export interface CrmOpportunityRow {
  id: string;
  opportunityNo: string;
  name: string;
  stage: CrmOpportunityStage;
  amount: number | null;
  probabilityPct: number | null;
  expectedCloseDate: string | null;
  ownerId: string | null;
  customerId: string | null;
  notes: string | null;
}

export interface CrmTaskRow {
  id: string;
  taskNo: string;
  title: string;
  description: string | null;
  status: CrmTaskStatus;
  dueAt: string | null;
  remindAt: string | null;
  priority: string | null;
  customerId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  notes: string | null;
}

export interface CrmBoardSummary {
  leads: number;
  openLeads: number;
  opportunities: number;
  openTasks: number;
  dueTasks: number;
}

export interface CrmScope {
  userId?: string;
}

export interface CrmOwnerRow {
  id: string;
  name: string;
  role: string;
}

export async function listCrmLeads(orgId: string, scope: CrmScope = {}): Promise<CrmLeadRow[]> {
  const rows = await prisma.crmLead.findMany({
    where: { orgId, ...(scope.userId ? { ownerId: scope.userId } : {}) },
    orderBy: [{ status: "asc" }, { nextFollowUpAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    leadNo: row.leadNo,
    name: row.name,
    companyName: row.companyName,
    source: row.source,
    status: row.status as CrmLeadStatus,
    region: row.region,
    phone: row.phone,
    email: row.email,
    interestedIn: row.interestedIn,
    nextFollowUpAt: iso(row.nextFollowUpAt),
    convertedAt: iso(row.convertedAt),
    notes: row.notes,
    customerId: row.customerId,
    ownerId: row.ownerId,
  }));
}

export async function listCrmOpportunities(orgId: string, scope: CrmScope = {}): Promise<CrmOpportunityRow[]> {
  const rows = await prisma.crmOpportunity.findMany({
    where: { orgId, ...(scope.userId ? { ownerId: scope.userId } : {}) },
    orderBy: [{ stage: "asc" }, { expectedCloseDate: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    opportunityNo: row.opportunityNo,
    name: row.name,
    stage: row.stage as CrmOpportunityStage,
    amount: dec(row.amount),
    probabilityPct: dec(row.probabilityPct),
    expectedCloseDate: dayKey(row.expectedCloseDate),
    ownerId: row.ownerId,
    customerId: row.customerId,
    notes: row.notes,
  }));
}

export async function listCrmTasks(orgId: string, scope: CrmScope = {}): Promise<CrmTaskRow[]> {
  const rows = await prisma.crmTask.findMany({
    where: { orgId, ...(scope.userId ? { assigneeId: scope.userId } : {}) },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    taskNo: row.taskNo,
    title: row.title,
    description: row.description,
    status: row.status as CrmTaskStatus,
    dueAt: iso(row.dueAt),
    remindAt: iso(row.remindAt),
    priority: row.priority,
    customerId: row.customerId,
    leadId: row.leadId,
    opportunityId: row.opportunityId,
    notes: row.notes,
  }));
}

export async function getCrmSummary(orgId: string, scope: CrmScope = {}): Promise<CrmBoardSummary> {
  const leadWhere = { orgId, ...(scope.userId ? { ownerId: scope.userId } : {}) };
  const opportunityWhere = { orgId, ...(scope.userId ? { ownerId: scope.userId } : {}) };
  const taskWhere = { orgId, ...(scope.userId ? { assigneeId: scope.userId } : {}) };
  const [leads, opportunities, tasks] = await Promise.all([
    prisma.crmLead.count({ where: leadWhere }),
    prisma.crmOpportunity.count({ where: opportunityWhere }),
    prisma.crmTask.findMany({ where: { ...taskWhere, status: "Open" } }),
  ]);
  const dueTasks = tasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() <= Date.now()).length;
  return {
    leads,
    openLeads: await prisma.crmLead.count({ where: { ...leadWhere, status: { in: ["New", "Qualified"] } } }),
    opportunities,
    openTasks: tasks.length,
    dueTasks,
  };
}

export async function listCrmOwners(orgId: string): Promise<CrmOwnerRow[]> {
  const rows = await prisma.user.findMany({
    where: {
      orgId,
      isActive: true,
      role: { in: ["admin", "gm", "manager", "sales_executive"] },
    },
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
    select: { id: true, fullName: true, email: true, role: true },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.fullName ?? row.email,
    role: row.role,
  }));
}
