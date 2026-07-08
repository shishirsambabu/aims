import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WarehousePrintButton } from "@/components/warehouse/WarehousePrintButton";
import { requireSession } from "@/lib/auth";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

type TemplateId =
  | "grn"
  | "grading"
  | "repacking"
  | "temperature"
  | "dispatch"
  | "reconciliation"
  | "nc"
  | "gate-pass";

const TEMPLATES: Record<
  TemplateId,
  {
    title: string;
    formNo: string;
    stage: string;
    filledBy: string;
    purpose: string;
    fields: string[];
    checkpoints: string[];
  }
> = {
  grn: {
    title: "Goods Received Note",
    formNo: "AEDEN/WH/T-01",
    stage: "Inbound / Receiving",
    filledBy: "Storekeeper",
    purpose: "Record container receipt, document verification, pulp temperature, condition, and put-away location.",
    fields: ["GRN No.", "Date", "Location", "Container / Vehicle No.", "Supplier / Origin", "Product", "Grade", "Boxes / Pallets", "Net Wt (kg)", "Pulp Temp (C)", "Condition", "Location"],
    checkpoints: ["Invoice verified", "Packing list verified", "Phyto / import docs verified", "Seal intact", "Shortage/damage/temp deviation captured"],
  },
  grading: {
    title: "QC / Grading Report",
    formNo: "AEDEN/WH/T-02",
    stage: "Grading & Quality Control",
    filledBy: "Supervisor / QC",
    purpose: "Split fruit into saleable grades and reconcile input weight against grade output plus reject/waste.",
    fields: ["Report No.", "Date / Shift", "Product", "Source GRN No.", "Graded By", "Grade Criteria", "Qty (boxes)", "Weight (kg)", "% of Input"],
    checkpoints: ["Reject % within range", "High reject cause noted", "Flagged to manager", "Input equals graded plus reject"],
  },
  repacking: {
    title: "Repacking Log",
    formNo: "AEDEN/WH/T-03",
    stage: "Repacking",
    filledBy: "Packing Supervisor",
    purpose: "Convert graded fruit into customer-ready pack specs with pack-in, pack-out, and wastage reconciliation.",
    fields: ["Log No. / Date", "Product / Grade", "Order / Ref", "Pack Spec", "Input Used", "Finished Packs", "Finished Weight", "Wastage", "Moved To"],
    checkpoints: ["Balance OK", "Packed by captured", "Stock updated by storekeeper", "Wastage reason/evidence captured"],
  },
  temperature: {
    title: "Cold Storage / Ripening Temperature Log",
    formNo: "AEDEN/WH/T-04",
    stage: "Storage",
    filledBy: "Supervisor",
    purpose: "Record cold-room/ripening readings and create action trail for any temperature deviation.",
    fields: ["Chamber / Room", "Date", "Target Temp", "Product Held", "Time", "Temp", "Humidity", "Within Spec", "Action if Deviation", "Checked By"],
    checkpoints: ["Deviation action recorded", "Warehouse manager escalated", "NC report raised if product affected"],
  },
  dispatch: {
    title: "Pick & Dispatch Sheet",
    formNo: "AEDEN/WH/T-05",
    stage: "Outbound",
    filledBy: "Supervisor / Billing",
    purpose: "Match ordered, picked, QC approved, loaded, and invoiced quantities before vehicle release.",
    fields: ["Dispatch No. / Date", "Customer", "Order Ref", "Vehicle No.", "Dispatch Window", "Product", "Grade", "Ordered", "Picked", "QC OK", "Loaded", "Invoice Qty"],
    checkpoints: ["Loaded equals dispatch sheet", "Loaded equals invoice", "No wrong-grade dispatch", "Gate pass linked"],
  },
  reconciliation: {
    title: "Daily Stock Reconciliation",
    formNo: "AEDEN/WH/T-06",
    stage: "All Stages / EOD",
    filledBy: "Storekeeper",
    purpose: "Reconcile opening, inward, repack-in, dispatched, wastage, system closing, physical closing, and variance.",
    fields: ["Date / Location", "Prepared By", "Verified By", "Product / Grade", "Opening", "Inward", "Repack In", "Dispatched", "Wastage", "System Closing", "Physical", "Variance"],
    checkpoints: ["Variance investigated same day", "Cause recorded", "NC raised for loss/damage", "Ledger not adjusted to hide shortage"],
  },
  nc: {
    title: "Non-Conformance / Quarantine / Wastage Report",
    formNo: "AEDEN/WH/T-07",
    stage: "Any Stage",
    filledBy: "Supervisor",
    purpose: "Capture shortage, damage, temperature deviation, quarantine, downgrade, claim, or write-off decisions.",
    fields: ["NC No. / Date", "Stage", "Product / GRN Ref", "Raised By", "Issue Type", "Qty / Weight", "Root Cause", "Action Taken", "Disposition", "Escalated To"],
    checkpoints: ["Return/claim", "Downgrade", "Write-off/waste", "Manager approval", "Evidence reference attached"],
  },
  "gate-pass": {
    title: "Gate Pass",
    formNo: "AEDEN/WH/T-08",
    stage: "Outbound",
    filledBy: "Billing / Security",
    purpose: "Release vehicle only after invoice, challan, gate pass, packages, weight, and gate check agree.",
    fields: ["Gate Pass No.", "Date / Time Out", "Location", "Type", "Customer / To", "Invoice No.", "Challan No.", "Vehicle No.", "Driver Name", "Driver Contact", "Total Packages", "Total Weight"],
    checkpoints: ["Invoice with driver", "Delivery challan with driver", "Gate pass copy", "Load matches invoice", "Packages counted", "Seal/photo if required"],
  },
};

interface PageProps {
  searchParams: Promise<{ template?: string }>;
}

function normalizeTemplate(value: string | undefined): TemplateId {
  return value && value in TEMPLATES ? (value as TemplateId) : "grn";
}

export default async function WarehouseTemplatesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await requireSession();
  requirePageAccess(session.role, ["inventory.view"]);
  const selected = normalizeTemplate(params.template);
  const template = TEMPLATES[selected];

  return (
    <div>
      <PageHeader
        title="Warehouse SOP Templates"
        description="Digital and printable warehouse control forms mapped from the Aeden warehouse SOP."
        actions={
          <div className="flex flex-wrap gap-2">
            <WarehousePrintButton />
            <Button asChild variant="outline">
              <Link href="/warehouse">Back to warehouse</Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 p-6 xl:grid-cols-[0.35fr_0.65fr]">
        <Card className="rounded-lg print:hidden">
          <CardContent className="space-y-2 p-4">
            {Object.entries(TEMPLATES).map(([id, item]) => (
              <Button
                key={id}
                asChild
                variant={id === selected ? "default" : "ghost"}
                className="w-full justify-start"
              >
                <Link href={`/warehouse/templates?template=${id}`}>{item.title}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Aeden Fruits International Pvt Ltd - Warehouse Operations
                </p>
                <h2 className="mt-3 font-heading text-3xl font-bold">{template.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{template.purpose}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline">{template.formNo}</Badge>
                <p className="mt-2 text-sm text-muted-foreground">{template.stage}</p>
                <p className="text-sm text-muted-foreground">Filled by: {template.filledBy}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {template.fields.map((field) => (
                <div key={field} className="rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field}</p>
                  <div className="mt-4 h-8 border-b border-dashed border-slate-400" />
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <p className="font-heading font-semibold">SOP checkpoints</p>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {template.checkpoints.map((checkpoint) => (
                  <div key={checkpoint} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
                    [ ] {checkpoint}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Signature label="Prepared by" />
              <Signature label="Verified by" />
              <Signature label="Approved by / Security" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-8 border-b border-dashed border-slate-400" />
      <p className="mt-2 text-xs text-muted-foreground">Name / Signature / Date</p>
    </div>
  );
}
