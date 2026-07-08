"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, CheckCircle2, Clock3, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatINR } from "@/lib/utils";
import type {
  CrmLeadRow,
  CrmOpportunityRow,
  CrmTaskRow,
  CrmBoardSummary,
} from "@/lib/data/crm";

type LeadForm = {
  name: string;
  companyName: string;
  source: string;
  region: string;
  phone: string;
  email: string;
  interestedIn: string;
  nextFollowUpAt: string;
  notes: string;
  customerId: string;
  ownerId: string;
};

type OpportunityForm = {
  name: string;
  leadId: string;
  customerId: string;
  ownerId: string;
  stage: string;
  amount: string;
  probabilityPct: string;
  expectedCloseDate: string;
  notes: string;
};

type TaskForm = {
  title: string;
  customerId: string;
  leadId: string;
  opportunityId: string;
  assigneeId: string;
  dueAt: string;
  remindAt: string;
  priority: string;
  description: string;
  notes: string;
};

const emptyLead: LeadForm = {
  name: "",
  companyName: "",
  source: "",
  region: "",
  phone: "",
  email: "",
  interestedIn: "",
  nextFollowUpAt: "",
  notes: "",
  customerId: "",
  ownerId: "",
};

const emptyOpportunity: OpportunityForm = {
  name: "",
  leadId: "",
  customerId: "",
  ownerId: "",
  stage: "Prospecting",
  amount: "",
  probabilityPct: "",
  expectedCloseDate: "",
  notes: "",
};

const emptyTask: TaskForm = {
  title: "",
  customerId: "",
  leadId: "",
  opportunityId: "",
  assigneeId: "",
  dueAt: "",
  remindAt: "",
  priority: "Normal",
  description: "",
  notes: "",
};

const OPPORTUNITY_STAGES = [
  "Prospecting",
  "Qualification",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;

const CRM_CONTROL_POINTS = [
  {
    title: "Customer classification",
    description: "Wholesale, retail, modern retail, HORECA, institutional, and distributor accounts stay segmented for pricing, credit, and service rules.",
  },
  {
    title: "Onboarding SOP",
    description: "Lead capture moves through KYC, GST/PAN checks, owner assignment, credit approval, and activation before ordering.",
  },
  {
    title: "Credit and exposure",
    description: "Customer risk links to credit hold, limit utilization, receivables, disputes, collections, and override reasons.",
  },
  {
    title: "Sales history",
    description: "CRM accounts link into quotes, orders, day-price usage, dispatches, customer analytics, and collections follow-up.",
  },
] as const;

export function CrmWorkspace({
  summary,
  leads,
  opportunities,
  tasks,
  customers,
  owners,
}: {
  summary: CrmBoardSummary;
  leads: CrmLeadRow[];
  opportunities: CrmOpportunityRow[];
  tasks: CrmTaskRow[];
  customers: { id: string; name: string; code: string }[];
  owners: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLead);
  const [opportunityForm, setOpportunityForm] = useState<OpportunityForm>(emptyOpportunity);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);
  const [busy, setBusy] = useState<"lead" | "opportunity" | "task" | null>(null);

  const openLeads = useMemo(() => leads.filter((lead) => lead.status !== "Converted" && lead.status !== "Disqualified"), [leads]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status === "Open"), [tasks]);
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);

  async function submit(kind: "lead" | "opportunity" | "task") {
    setBusy(kind);
    try {
      const payload =
        kind === "lead"
          ? leadForm
          : kind === "opportunity"
            ? opportunityForm
            : taskForm;
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save CRM record");
        return;
      }
      toast.success("Saved");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function update(kind: "lead" | "opportunity" | "task", id: string, data: Record<string, unknown>) {
    const res = await fetch("/api/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, ...data }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to update CRM record");
      return;
    }
    toast.success("Updated");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Leads" value={summary.leads} icon={Target} />
        <Metric label="Active leads" value={summary.openLeads} icon={Clock3} />
        <Metric label="Opportunities" value={summary.opportunities} icon={Target} />
        <Metric label="Due tasks" value={summary.dueTasks} icon={CheckCircle2} />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="label-caps">CRM operating model</p>
            <h3 className="mt-1 font-heading text-xl font-semibold">
              Account lifecycle from lead to collections
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This CRM is tied to the ERP flow: lead ownership, customer class,
              credit approval, orders, dispatch history, disputes, and receivables
              all stay on the same account record.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/customers">Open customer master</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/sales">Open sales desk</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/sop">Open SOP center</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CRM_CONTROL_POINTS.map((point) => (
              <div
                key={point.title}
                className="rounded-xl border border-border bg-surface-alt/40 p-3"
              >
                <p className="font-medium">{point.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-heading text-lg font-semibold">Lead funnel</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {["New", "Qualified", "Converted", "Disqualified"].map((status) => (
                  <div key={status} className="rounded-xl border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{status}</p>
                    <p className="mt-1 font-financial text-2xl font-semibold">
                      {leads.filter((lead) => lead.status === status).length}
                    </p>
                    <div className="mt-3 space-y-2">
                      {leads.filter((lead) => lead.status === status).slice(0, 3).map((lead) => (
                        <div key={lead.id} className="rounded-lg bg-surface-alt/40 p-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{lead.name}</p>
                              <p className="text-xs text-muted-foreground">{lead.companyName ?? "Individual"} - {lead.source ?? "No source"}</p>
                            </div>
                            {status !== "Converted" && status !== "Disqualified" ? (
                              <Button size="sm" variant="outline" onClick={() => update("lead", lead.id, { status: status === "New" ? "Qualified" : "Converted" })}>
                                Move
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-heading text-lg font-semibold">Opportunities</h3>
                <div className="mt-4 space-y-2">
                        {opportunities.map((opp) => (
                          <div key={opp.id} className="rounded-xl border border-border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">{opp.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {opp.opportunityNo} - {opp.expectedCloseDate ?? "No close date"}
                                </p>
                              </div>
                              <Select
                                value={opp.stage}
                                onValueChange={(stage) => update("opportunity", opp.id, { stage })}
                              >
                                <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {OPPORTUNITY_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {opp.customerId ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Customer{" "}
                                <Link href={`/customers/${opp.customerId}`} className="font-medium text-primary hover:underline">
                                  {customerMap.get(opp.customerId)?.name ?? opp.customerId}
                                </Link>
                              </p>
                            ) : null}
                            <p className="mt-2 text-sm text-muted-foreground">
                              {formatINR(opp.amount)} - {opp.probabilityPct ?? 0}% probability
                            </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-heading text-lg font-semibold">Forecast</h3>
                <ForecastCard value={opportunities.reduce((sum, opp) => sum + (opp.amount ?? 0) * ((opp.probabilityPct ?? 0) / 100), 0)} />
                <div className="mt-4 text-sm text-muted-foreground">
                  Weighted by probability. This is the manager view for the active pipeline.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-heading text-lg font-semibold">Task board</h3>
              <div className="mt-4 space-y-2">
                    {openTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No open CRM tasks yet.</p>
                    ) : openTasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.taskNo} - due {task.dueAt ? formatDate(task.dueAt) : "No due date"}
                            </p>
                          </div>
                          <Button size="sm" onClick={() => update("task", task.id, { status: "Done" })}>
                            Complete
                          </Button>
                        </div>
                        {task.customerId ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Customer{" "}
                            <Link href={`/customers/${task.customerId}`} className="font-medium text-primary hover:underline">
                              {customerMap.get(task.customerId)?.name ?? task.customerId}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="font-heading text-lg font-semibold">New Lead</h3>
              <Field label="Name"><Input value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} /></Field>
              <Field label="Company"><Input value={leadForm.companyName} onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })} /></Field>
              <Field label="Source"><Input value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} /></Field>
              <Field label="Region"><Input value={leadForm.region} onChange={(e) => setLeadForm({ ...leadForm, region: e.target.value })} /></Field>
              <Field label="Existing customer">
                <Select value={leadForm.customerId || "none"} onValueChange={(value) => setLeadForm({ ...leadForm, customerId: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Optional account link" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked customer</SelectItem>
                    {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.code} - {customer.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Owner">
                <Select value={leadForm.ownerId || "self"} onValueChange={(value) => setLeadForm({ ...leadForm, ownerId: value === "self" ? "" : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Assign to me</SelectItem>
                    {owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Follow-up"><Input type="date" value={leadForm.nextFollowUpAt} onChange={(e) => setLeadForm({ ...leadForm, nextFollowUpAt: e.target.value })} /></Field>
              <Field label="Notes"><Textarea value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} /></Field>
              <Button onClick={() => void submit("lead")} disabled={busy === "lead"}><Plus className="mr-2 h-4 w-4" /> Save lead</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="font-heading text-lg font-semibold">New Opportunity</h3>
              <Field label="Name"><Input value={opportunityForm.name} onChange={(e) => setOpportunityForm({ ...opportunityForm, name: e.target.value })} /></Field>
              <Field label="Amount"><Input value={opportunityForm.amount} onChange={(e) => setOpportunityForm({ ...opportunityForm, amount: e.target.value })} /></Field>
              <Field label="Probability %"><Input value={opportunityForm.probabilityPct} onChange={(e) => setOpportunityForm({ ...opportunityForm, probabilityPct: e.target.value })} /></Field>
              <Field label="Stage">
                <Select value={opportunityForm.stage} onValueChange={(stage) => setOpportunityForm({ ...opportunityForm, stage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OPPORTUNITY_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Customer">
                <Select value={opportunityForm.customerId || "none"} onValueChange={(value) => setOpportunityForm({ ...opportunityForm, customerId: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Optional customer" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No linked customer</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.code} - {customer.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Lead">
                <Select value={opportunityForm.leadId || "none"} onValueChange={(value) => setOpportunityForm({ ...opportunityForm, leadId: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Optional lead" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No linked lead</SelectItem>{openLeads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.leadNo} - {lead.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Owner">
                <Select value={opportunityForm.ownerId || "self"} onValueChange={(value) => setOpportunityForm({ ...opportunityForm, ownerId: value === "self" ? "" : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="self">Assign to me</SelectItem>{owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Expected close"><Input type="date" value={opportunityForm.expectedCloseDate} onChange={(e) => setOpportunityForm({ ...opportunityForm, expectedCloseDate: e.target.value })} /></Field>
              <Field label="Notes"><Textarea value={opportunityForm.notes} onChange={(e) => setOpportunityForm({ ...opportunityForm, notes: e.target.value })} /></Field>
              <Button onClick={() => void submit("opportunity")} disabled={busy === "opportunity"}><Plus className="mr-2 h-4 w-4" /> Save opportunity</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="font-heading text-lg font-semibold">New Task</h3>
              <Field label="Title"><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></Field>
              <Field label="Due date"><Input type="date" value={taskForm.dueAt} onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })} /></Field>
              <Field label="Reminder"><Input type="datetime-local" value={taskForm.remindAt} onChange={(e) => setTaskForm({ ...taskForm, remindAt: e.target.value })} /></Field>
              <Field label="Priority"><Input value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })} /></Field>
              <Field label="Customer">
                <Select value={taskForm.customerId || "none"} onValueChange={(value) => setTaskForm({ ...taskForm, customerId: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Optional customer" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No linked customer</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.code} - {customer.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Opportunity">
                <Select value={taskForm.opportunityId || "none"} onValueChange={(value) => setTaskForm({ ...taskForm, opportunityId: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Optional opportunity" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No linked opportunity</SelectItem>{opportunities.map((opportunity) => <SelectItem key={opportunity.id} value={opportunity.id}>{opportunity.opportunityNo} - {opportunity.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Assignee">
                <Select value={taskForm.assigneeId || "self"} onValueChange={(value) => setTaskForm({ ...taskForm, assigneeId: value === "self" ? "" : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="self">Assign to me</SelectItem>{owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Description"><Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></Field>
              <Button onClick={() => void submit("task")} disabled={busy === "task"}><Plus className="mr-2 h-4 w-4" /> Save task</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-financial mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastCard({ value }: { value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface-alt/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Weighted forecast</p>
      <p className="font-financial mt-2 text-4xl font-semibold">{formatINR(value)}</p>
      <p className="mt-1 text-sm text-muted-foreground">Pipeline-weighted sales estimate</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
