import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity, writeActivity } from "@/lib/activity";
import { listCrmLeads, listCrmOpportunities, listCrmTasks } from "@/lib/data/crm";
import { nextDocumentNumber } from "@/lib/document-sequence";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "crm.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const scope = session.role === "sales_executive" ? { userId: session.userId } : {};
    const [leads, opportunities, tasks] = await Promise.all([
      listCrmLeads(session.orgId, scope),
      listCrmOpportunities(session.orgId, scope),
      listCrmTasks(session.orgId, scope),
    ]);
    return NextResponse.json({ data: { leads, opportunities, tasks } });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "crm.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
    const kind = normalize(body.kind);
    if (!["lead", "opportunity", "task"].includes(kind)) {
      return NextResponse.json({ error: "Invalid CRM entity" }, { status: 422 });
    }

    if (kind === "lead") {
      const customerId = normalize(body.customerId) || null;
      const ownerId = normalize(body.ownerId) || session.userId;
      await validateCrmReferences(session.orgId, { customerId, userId: ownerId });
      const lead = await prisma.$transaction(async (tx) => {
        const day = dayKey(new Date());
        const leadNo = await nextDocumentNumber(tx, session.orgId, `crm-lead:${day}`, `LEAD-${day}`, 3);
        const created = await tx.crmLead.create({ data: {
          orgId: session.orgId,
          leadNo,
          customerId,
          name: normalize(body.name),
          companyName: normalize(body.companyName) || null,
          source: normalize(body.source) || null,
          region: normalize(body.region) || null,
          phone: normalize(body.phone) || null,
          email: normalize(body.email) || null,
          interestedIn: normalize(body.interestedIn) || null,
          nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null,
          notes: normalize(body.notes) || null,
          ownerId,
        } });
        await writeActivity(tx, { orgId: session.orgId, userId: session.userId, action: "created_crm_lead", entityType: "crm_lead", entityId: created.id, summary: `Created lead ${created.leadNo} - ${created.name}`, metadata: { after: created } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return NextResponse.json({ data: lead }, { status: 201 });
    }

    if (kind === "opportunity") {
      const leadId = normalize(body.leadId) || null;
      const customerId = normalize(body.customerId) || null;
      const ownerId = normalize(body.ownerId) || session.userId;
      await validateCrmReferences(session.orgId, { customerId, leadId, userId: ownerId });
      const opportunity = await prisma.$transaction(async (tx) => {
        const day = dayKey(new Date());
        const opportunityNo = await nextDocumentNumber(tx, session.orgId, `crm-opportunity:${day}`, `OPP-${day}`, 3);
        const created = await tx.crmOpportunity.create({ data: {
          orgId: session.orgId,
          opportunityNo,
          leadId,
          customerId,
          ownerId,
          name: normalize(body.name),
          stage: body.stage || "Prospecting",
          amount: body.amount ? Number(body.amount) : null,
          probabilityPct: body.probabilityPct ? Number(body.probabilityPct) : null,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          notes: normalize(body.notes) || null,
        } });
        await writeActivity(tx, { orgId: session.orgId, userId: session.userId, action: "created_crm_opportunity", entityType: "crm_opportunity", entityId: created.id, summary: `Created opportunity ${created.opportunityNo} - ${created.name}`, metadata: { after: created } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return NextResponse.json({ data: opportunity }, { status: 201 });
    }

    const customerId = normalize(body.customerId) || null;
    const leadId = normalize(body.leadId) || null;
    const opportunityId = normalize(body.opportunityId) || null;
    const assigneeId = normalize(body.assigneeId) || session.userId;
    await validateCrmReferences(session.orgId, {
      customerId,
      leadId,
      opportunityId,
      userId: assigneeId,
    });
    const task = await prisma.$transaction(async (tx) => {
      const day = dayKey(new Date());
      const taskNo = await nextDocumentNumber(tx, session.orgId, `crm-task:${day}`, `TASK-${day}`, 3);
      const created = await tx.crmTask.create({ data: {
        orgId: session.orgId,
        taskNo,
        customerId,
        leadId,
        opportunityId,
        assigneeId,
        title: normalize(body.title),
        description: normalize(body.description) || null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        remindAt: body.remindAt ? new Date(body.remindAt) : null,
        priority: normalize(body.priority) || "Normal",
        notes: normalize(body.notes) || null,
      } });
      await writeActivity(tx, { orgId: session.orgId, userId: session.userId, action: "created_crm_task", entityType: "crm_task", entityId: created.id, summary: `Created task ${created.taskNo} - ${created.title}`, metadata: { after: created } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ data: task }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "crm.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
    const kind = normalize(body.kind);
    const id = normalize(body.id);
    if (!kind || !id) {
      return NextResponse.json({ error: "Invalid CRM update" }, { status: 422 });
    }

    if (kind === "lead") {
      const current = await prisma.crmLead.findFirst({
        where: {
          id,
          orgId: session.orgId,
          ...(session.role === "sales_executive" ? { ownerId: session.userId } : {}),
        },
      });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const lead = await prisma.crmLead.update({
        where: { id },
        data: {
          status: body.status ?? undefined,
          nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : undefined,
          convertedAt:
            body.status === "Converted"
              ? current.convertedAt ?? new Date()
              : body.convertedAt
                ? new Date(body.convertedAt)
                : undefined,
          notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "updated_crm_lead",
        entityType: "crm_lead",
        entityId: lead.id,
        summary: `Updated lead ${lead.leadNo}`,
        metadata: { after: lead },
      });
      return NextResponse.json({ data: lead });
    }

    if (kind === "opportunity") {
      const current = await prisma.crmOpportunity.findFirst({
        where: {
          id,
          orgId: session.orgId,
          ...(session.role === "sales_executive" ? { ownerId: session.userId } : {}),
        },
        select: { id: true },
      });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const opportunity = await prisma.crmOpportunity.update({
        where: { id },
        data: {
          stage: body.stage ?? undefined,
          amount: body.amount !== undefined ? Number(body.amount) : undefined,
          probabilityPct: body.probabilityPct !== undefined ? Number(body.probabilityPct) : undefined,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
          notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "updated_crm_opportunity",
        entityType: "crm_opportunity",
        entityId: opportunity.id,
        summary: `Updated opportunity ${opportunity.opportunityNo}`,
        metadata: { after: opportunity },
      });
      return NextResponse.json({ data: opportunity });
    }

    const currentTask = await prisma.crmTask.findFirst({
      where: {
        id,
        orgId: session.orgId,
        ...(session.role === "sales_executive" ? { assigneeId: session.userId } : {}),
      },
      select: { id: true },
    });
    if (!currentTask) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const task = await prisma.crmTask.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        remindAt: body.remindAt ? new Date(body.remindAt) : undefined,
        completedAt: body.status === "Done" ? new Date() : undefined,
        notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
      },
    });
    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "updated_crm_task",
      entityType: "crm_task",
      entityId: task.id,
      summary: `Updated task ${task.taskNo}`,
      metadata: { after: task },
    });
    return NextResponse.json({ data: task });
  } catch (err) {
    return handleError(err);
  }
}

async function validateCrmReferences(
  orgId: string,
  refs: {
    customerId?: string | null;
    leadId?: string | null;
    opportunityId?: string | null;
    userId?: string | null;
  }
) {
  const checks = await Promise.all([
    refs.customerId
      ? prisma.customer.count({ where: { id: refs.customerId, orgId, deletedAt: null } })
      : 1,
    refs.leadId ? prisma.crmLead.count({ where: { id: refs.leadId, orgId } }) : 1,
    refs.opportunityId
      ? prisma.crmOpportunity.count({ where: { id: refs.opportunityId, orgId } })
      : 1,
    refs.userId
      ? prisma.user.count({ where: { id: refs.userId, orgId, isActive: true } })
      : 1,
  ]);
  if (checks.some((count) => count !== 1)) {
    throw new Error("INVALID_CRM_REFERENCE");
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof Error && err.message === "INVALID_CRM_REFERENCE") {
    return NextResponse.json(
      { error: "A linked customer, lead, opportunity, or assignee is invalid" },
      { status: 422 }
    );
  }
  console.error("[api/crm]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
