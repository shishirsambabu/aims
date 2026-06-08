"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileText, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  DocStatusBadge,
  PaymentStatusBadge,
} from "@/components/containers/StatusBadge";
import { CostPanel } from "@/components/containers/CostPanel";
import { SalesPanel } from "@/components/containers/SalesPanel";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { Button } from "@/components/ui/button";
import { cn, formatUSD, formatDate } from "@/lib/utils";
import {
  CONTAINER_STATUSES,
  CONTAINER_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  REQUIRED_DOC_TYPES,
} from "@/lib/constants";
import {
  canTransition,
  stageRequirement,
  type WorkflowContext,
} from "@/lib/workflow";
import type { ContainerStatus, DocumentType } from "@/types";

// Loose shape — Decimal/Date fields arrive JSON-serialised as strings.
interface DetailData {
  id: string;
  containerNo: string;
  blNo: string;
  customer: string | null;
  port: string | null;
  portCode: string | null;
  item: string | null;
  variety: string | null;
  noOfBoxes: number | null;
  status: ContainerStatus;
  etd: string | null;
  eta: string | null;
  bookingDate: string | null;
  remarks: string | null;
  supplier: { name: string; country: string | null } | null;
  shipmentItem: Record<string, unknown> | null;
  cost: Record<string, unknown> | null;
  sale: Record<string, unknown> | null;
  documents: DocRow[];
  payments: PaymentRow[];
}

interface DocRow {
  id: string;
  type: DocumentType;
  docNo: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: "Pending" | "Uploaded" | "Verified" | "Expired";
}

interface PaymentRow {
  id: string;
  supplierName: string | null;
  amountRequested: string | number;
  amountPaid: string | number;
  currency: string;
  status: "Pending" | "Partial" | "Paid";
  requestDate: string | null;
  dueDate: string | null;
}

interface ActivityRow {
  id: string;
  action: string;
  summary: string | null;
  createdAt: string;
  user: { fullName: string | null; email: string } | null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export interface DetailPerms {
  container: boolean; // edit container / change status
  cost: boolean; // edit costs
  finalize: boolean; // finalize cost sheet
  unlock: boolean; // unlock cost sheet
  sale: boolean; // edit sales
  docs: boolean; // upload documents
  financials: boolean; // see cost / profit / payment figures
}

export function ContainerDetail({
  container,
  activity,
  perms,
  orgId,
}: {
  container: DetailData;
  activity: ActivityRow[];
  perms: DetailPerms;
  orgId: string;
}) {
  return (
    <div className="p-6">
      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customs">Customs &amp; Invoice</TabsTrigger>
          {perms.financials && (
            <>
              <TabsTrigger value="costs">Costs &amp; Landing</TabsTrigger>
              <TabsTrigger value="sales">Sales &amp; Profit</TabsTrigger>
            </>
          )}
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {perms.financials && (
            <TabsTrigger value="payments">Payments</TabsTrigger>
          )}
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <div className="pt-6">
          <TabsContent value="overview">
            <OverviewTab container={container} canEdit={perms.container} />
          </TabsContent>
          <TabsContent value="customs">
            <CustomsTab item={container.shipmentItem} />
          </TabsContent>
          {perms.financials && (
            <>
              <TabsContent value="costs">
                <CostPanel
                  containerId={container.id}
                  noOfBoxes={container.noOfBoxes}
                  cost={container.cost}
                  canEdit={perms.cost}
                  canFinalize={perms.finalize}
                  canUnlock={perms.unlock}
                />
              </TabsContent>
              <TabsContent value="sales">
                <SalesPanel
                  containerId={container.id}
                  totalCost={num(container.cost?.totalCost)}
                  sale={container.sale}
                  canEdit={perms.sale}
                />
              </TabsContent>
            </>
          )}
          <TabsContent value="documents">
            <DocumentsTab
              documents={container.documents}
              containerId={container.id}
              orgId={orgId}
              canEdit={perms.docs}
            />
          </TabsContent>
          {perms.financials && (
            <TabsContent value="payments">
              <PaymentsTab payments={container.payments} />
            </TabsContent>
          )}
          <TabsContent value="activity">
            <ActivityTab activity={activity} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ----------------------------- shared bits ----------------------------- */

function DefItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-sm", mono && "font-financial")}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function SectionCard({
  title,
  children,
  empty,
}: {
  title: string;
  children?: React.ReactNode;
  empty?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-4 font-heading text-base font-semibold">{title}</h3>
        {empty ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------- tab 1 --------------------------------- */

function OverviewTab({
  container,
  canEdit,
}: {
  container: DetailData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ContainerStatus>(container.status);
  const [saving, setSaving] = useState(false);

  // Workflow context for stage-gating.
  const ctx: WorkflowContext = {
    presentDocTypes: container.documents.map((d) => d.type),
    hasSales: num(container.sale?.saleValue as unknown) != null,
  };
  const nextStage =
    CONTAINER_STATUSES[CONTAINER_STATUSES.indexOf(status) + 1];
  const nextReq = nextStage ? stageRequirement(nextStage) : null;
  const presentSet = new Set(ctx.presentDocTypes);

  async function changeStatus(next: ContainerStatus) {
    setSaving(true);
    setStatus(next);
    try {
      const res = await fetch(`/api/containers/${container.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update status");
        setStatus(container.status);
        return;
      }
      toast.success(`Status updated to ${CONTAINER_STATUS_LABELS[next]}`);
      router.refresh();
    } catch {
      toast.error("Network error");
      setStatus(container.status);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Container Identity">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DefItem label="Container No" value={container.containerNo} mono />
          <DefItem label="BL No" value={container.blNo} mono />
          <DefItem label="Supplier" value={container.supplier?.name} />
          <DefItem label="Customer" value={container.customer} />
          <DefItem
            label="Port"
            value={
              container.port
                ? `${container.port}${
                    container.portCode ? ` (${container.portCode})` : ""
                  }`
                : null
            }
          />
          <DefItem label="Item" value={container.item} />
          <DefItem label="Variety" value={container.variety} />
          <DefItem
            label="No. of Boxes"
            value={container.noOfBoxes?.toLocaleString("en-IN")}
            mono
          />
        </dl>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Schedule">
          <dl className="grid gap-5 sm:grid-cols-3">
            <DefItem
              label="Booking"
              value={formatDate(container.bookingDate)}
              mono
            />
            <DefItem label="ETD" value={formatDate(container.etd)} mono />
            <DefItem label="ETA" value={formatDate(container.eta)} mono />
          </dl>
        </SectionCard>

        <SectionCard title="Status">
          <div className="space-y-3">
            <select
              value={status}
              disabled={!canEdit || saving}
              onChange={(e) =>
                changeStatus(e.target.value as ContainerStatus)
              }
              className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              {CONTAINER_STATUSES.map((s) => {
                const blocked = !canTransition(status, s, ctx).ok;
                return (
                  <option key={s} value={s} disabled={blocked}>
                    {CONTAINER_STATUS_LABELS[s]}
                    {blocked ? " 🔒" : ""}
                  </option>
                );
              })}
            </select>
            {nextStage &&
              nextReq &&
              (nextReq.docs.length > 0 || nextReq.needsSales) &&
              !canTransition(status, nextStage, ctx).ok && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs">
                  <p className="font-medium text-[#9A6212]">
                    To advance to {CONTAINER_STATUS_LABELS[nextStage]}:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {nextReq.docs.map((d) => (
                      <li key={d} className="flex items-center gap-1.5">
                        {presentSet.has(d) ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground/50" />
                        )}
                        {DOCUMENT_TYPE_LABELS[d]}
                      </li>
                    ))}
                    {nextReq.needsSales && (
                      <li className="flex items-center gap-1.5">
                        {ctx.hasSales ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <Circle className="h-3 w-3 text-muted-foreground/50" />
                        )}
                        Sales recorded
                      </li>
                    )}
                  </ul>
                </div>
              )}
            {!canEdit && (
              <p className="text-xs text-muted-foreground">
                Viewers can&apos;t change status.
              </p>
            )}
            {saving && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      {container.remarks && (
        <SectionCard title="Remarks">
          <p className="text-sm">{container.remarks}</p>
        </SectionCard>
      )}
    </div>
  );
}

/* ------------------------------- tab 2 --------------------------------- */

function CustomsTab({ item }: { item: Record<string, unknown> | null }) {
  if (!item) {
    return (
      <SectionCard
        title="Customs &amp; Invoice"
        empty="No invoice or Bill of Entry recorded yet. This is captured during customs clearance."
      />
    );
  }
  return (
    <SectionCard title="Customs &amp; Invoice">
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <DefItem label="Invoice No" value={item.invoiceNo as string} mono />
        <DefItem
          label="Invoice Date"
          value={formatDate(item.invoiceDate as string)}
          mono
        />
        <DefItem
          label="Invoice Value"
          value={formatUSD(num(item.invoiceValue))}
          mono
        />
        <DefItem label="BE No" value={item.beNo as string} mono />
        <DefItem
          label="BE Date"
          value={formatDate(item.beDate as string)}
          mono
        />
        <DefItem label="HS Code" value={item.hsCode as string} mono />
        <DefItem
          label="Net Weight (kg)"
          value={num(item.netWeightKg)?.toLocaleString("en-IN")}
          mono
        />
        <DefItem
          label="Gross Weight (kg)"
          value={num(item.grossWeightKg)?.toLocaleString("en-IN")}
          mono
        />
      </dl>
    </SectionCard>
  );
}

function DocumentsTab({
  documents,
  containerId,
  orgId,
  canEdit,
}: {
  documents: DocRow[];
  containerId: string;
  orgId: string;
  canEdit: boolean;
}) {
  const presentTypes = new Set(documents.map((d) => d.type));
  const score = REQUIRED_DOC_TYPES.filter((t) => presentTypes.has(t)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold">
          Document Completeness — {score}/9
        </h3>
        {canEdit && (
          <DocumentUpload
            orgId={orgId}
            containers={[]}
            presetContainerId={containerId}
            trigger={
              <Button size="sm">
                <FileText className="h-4 w-4" /> Upload Document
              </Button>
            }
          />
        )}
      </div>

      <SectionCard title="Checklist">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REQUIRED_DOC_TYPES.map((t) => {
            const has = presentTypes.has(t);
            return (
              <div
                key={t}
                className="flex items-center gap-2 text-sm"
              >
                {has ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40" />
                )}
                <span className={cn(!has && "text-muted-foreground")}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Uploaded Documents"
        empty={
          documents.length === 0
            ? "No documents uploaded yet. Use Upload Document to add one."
            : undefined
        }
      >
        {documents.length > 0 && (
          <ul className="divide-y divide-border">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between py-2.5"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {DOCUMENT_TYPE_LABELS[d.type]}
                    </p>
                    <p className="font-financial text-xs text-muted-foreground">
                      {d.docNo ?? "—"} · exp {formatDate(d.expiryDate)}
                    </p>
                  </div>
                </div>
                <DocStatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

/* ------------------------------- tab 6 --------------------------------- */

function PaymentsTab({ payments }: { payments: PaymentRow[] }) {
  return (
    <SectionCard
      title="Payments"
      empty={
        payments.length === 0
          ? "No payment requests yet. Payments tracking arrives in Phase 6."
          : undefined
      }
    >
      {payments.length > 0 && (
        <ul className="divide-y divide-border">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-financial text-sm font-medium">
                  {formatUSD(num(p.amountRequested))}
                  <span className="text-muted-foreground">
                    {" "}
                    · paid {formatUSD(num(p.amountPaid))}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.supplierName ?? "—"} · due {formatDate(p.dueDate)}
                </p>
              </div>
              <PaymentStatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ------------------------------- tab 7 --------------------------------- */

function ActivityTab({ activity }: { activity: ActivityRow[] }) {
  if (activity.length === 0) {
    return (
      <SectionCard
        title="Activity Log"
        empty="No activity recorded yet. Mutations are logged here."
      />
    );
  }
  return (
    <SectionCard title="Activity Log">
      <ol className="relative space-y-5 border-l border-border pl-5">
        {activity.map((a) => (
          <li key={a.id} className="relative">
            <span className="absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
            <p className="text-sm">{a.summary ?? a.action}</p>
            <p className="text-xs text-muted-foreground">
              {a.user?.fullName || a.user?.email || "System"} ·{" "}
              {formatDate(a.createdAt)}
            </p>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
