import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  PackageCheck,
  Recycle,
  Scale,
  ShipWheel,
  Snowflake,
  Truck,
  Users2,
} from "lucide-react";

export type SopStep = {
  title: string;
  owner: string;
  systemAction: string;
  control: string;
};

export type SopPlaybook = {
  id: string;
  title: string;
  module: "CRM" | "Warehouse" | "Sales" | "Finance" | "Import Docs";
  icon: LucideIcon;
  purpose: string;
  trigger: string;
  exitGate: string;
  erpHref: string;
  stakeholders: string[];
  handoff: string;
  steps: SopStep[];
  guardrails: string[];
};

export const SOP_PLAYBOOKS: SopPlaybook[] = [
  {
    id: "customer-onboarding",
    title: "Customer onboarding and credit activation",
    module: "CRM",
    icon: Users2,
    purpose: "Create only sales-ready customers with tax identity, buyer class, credit terms, and owner accountability.",
    trigger: "A new wholesaler, retailer, modern retail, HORECA, distributor, or institutional account wants to buy.",
    exitGate: "Customer class, GSTIN, PAN, credit limit, review date, rep, KYC, and approval are complete.",
    erpHref: "/customers",
    stakeholders: ["Sales rep", "CRM admin", "Finance", "Manager/admin"],
    handoff: "Sales rep submits customer. CRM verifies KYC. Finance sets credit discipline. Manager/admin approves.",
    steps: [
      {
        title: "Classify the buyer",
        owner: "Sales rep",
        systemAction: "Select Customer Class in CRM and add region, primary contact, and expected buying pattern.",
        control: "Free-text classes are blocked; only Aeden buyer classes are accepted.",
      },
      {
        title: "Verify tax identity",
        owner: "CRM/admin",
        systemAction: "Capture GSTIN and PAN, then upload KYC documents.",
        control: "Customer cannot be submitted without GSTIN and PAN.",
      },
      {
        title: "Set credit discipline",
        owner: "Finance/GM",
        systemAction: "Set credit limit, payment terms, and next credit review date.",
        control: "Use credit limit 0 for prepaid customers; credit hold changes need a reason.",
      },
      {
        title: "Maker-checker approval",
        owner: "Manager/admin",
        systemAction: "Approve or reject the customer with a review note.",
        control: "Requester cannot approve their own customer change.",
      },
    ],
    guardrails: [
      "No order approval for unapproved or credit-held customers.",
      "KYC rejection requires reason.",
      "Duplicate code/GSTIN/PAN is blocked before creation.",
      "Sales executives see only assigned-region customers.",
    ],
  },
  {
    id: "inward-container",
    title: "Inward container to cold-room receipt",
    module: "Warehouse",
    icon: Truck,
    purpose: "Move cleared imported fruit containers into named cold storage with full lot traceability.",
    trigger: "Container status reaches Cleared and physical goods arrive at the warehouse.",
    exitGate: "Container is assigned to warehouse, received into lots, and each lot has FEFO/cold-chain data.",
    erpHref: "/warehouse",
    stakeholders: ["Clearing/docs", "Warehouse admin", "QC", "Warehouse operator"],
    handoff: "Docs/clearing confirms clearance. Warehouse admin assigns location. QC checks condition. Operator receives lots.",
    steps: [
      {
        title: "Confirm warehouse assignment",
        owner: "Warehouse admin",
        systemAction: "Assign the container to the receiving warehouse before In Warehouse status.",
        control: "Stock receipt is blocked unless the container is in a named warehouse.",
      },
      {
        title: "Capture receipt lots",
        owner: "Warehouse operator",
        systemAction: "Create StockItem rows by item, variety, grade, UoM, lot, pallet, expiry, and location.",
        control: "Every receipt writes a stock movement ledger entry.",
      },
      {
        title: "Check temperature exposure",
        owner: "QC/warehouse",
        systemAction: "Record receipt temperature and breach flag where needed.",
        control: "Breached lots go to quarantine/hold until reviewed.",
      },
    ],
    guardrails: [
      "No warehouse-less stock.",
      "No negative receipt quantity.",
      "No blocked/quarantined stock should be dispatched.",
      "Room/bin location should be visible on the stock row.",
    ],
  },
  {
    id: "grading-repacking",
    title: "Grading, repacking, and reclassification",
    module: "Warehouse",
    icon: Scale,
    purpose: "Convert inbound mixed quality fruit into sellable grades while preserving movement truth.",
    trigger: "QC finds mixed grades, damaged packs, repack requirement, or market-specific sorting need.",
    exitGate: "Parent lot balance and child grade lots reconcile with wastage/dump recorded separately.",
    erpHref: "/warehouse",
    stakeholders: ["QC", "Warehouse operator", "Warehouse manager", "Sales"],
    handoff: "QC defines grade outcome. Warehouse performs split/repack. Manager records loss. Sales sees sellable lots.",
    steps: [
      {
        title: "Inspect source lot",
        owner: "QC",
        systemAction: "Select source stock lot and open grade split.",
        control: "Only existing stock lots can be split.",
      },
      {
        title: "Create grade outputs",
        owner: "Warehouse operator",
        systemAction: "Split into A/B/C/processing or business-specific grades with quantity and FEFO dates.",
        control: "Split quantity cannot exceed available stock.",
      },
      {
        title: "Record loss separately",
        owner: "QC/warehouse manager",
        systemAction: "Use wastage/dump action with evidence reference.",
        control: "Damage, wastage, and dump require reason and evidence reference.",
      },
    ],
    guardrails: [
      "No silent shrinkage.",
      "Repack and grade changes must be visible in movement history.",
      "Processing-grade stock must not be confused with premium retail-grade stock.",
    ],
  },
  {
    id: "fefo-outward",
    title: "FEFO outward dispatch",
    module: "Warehouse",
    icon: ShipWheel,
    purpose: "Dispatch imported fruits using FEFO, quality release, and gate-pass control.",
    trigger: "A sales order is approved or management authorizes direct dispatch.",
    exitGate: "Picked, packed, ready, and dispatched quantities match stock and order truth.",
    erpHref: "/warehouse?tab=outward",
    stakeholders: ["Sales", "Warehouse picker", "Packing team", "Dispatch supervisor"],
    handoff: "Sales approval creates dispatch need. Warehouse picks FEFO. Packing marks ready. Dispatch closes gate pass.",
    steps: [
      {
        title: "Select released stock",
        owner: "Warehouse operator",
        systemAction: "Use FEFO lot view and dispatch queue.",
        control: "Quality-held stock must be released before dispatch.",
      },
      {
        title: "Pick and pack",
        owner: "Warehouse team",
        systemAction: "Move gate pass through Picked, Packed, Ready.",
        control: "Manual status moves are audited through gate-pass workflow.",
      },
      {
        title: "Dispatch and close",
        owner: "Dispatch supervisor",
        systemAction: "Record dispatch quantities, vehicle, driver, and notes.",
        control: "Partial dispatch remains visible and does not break inventory balance.",
      },
    ],
    guardrails: [
      "FEFO dates drive dispatch priority.",
      "Direct dispatch exceptions require reason.",
      "Dispatch must reduce stock and preserve lot traceability.",
    ],
  },
  {
    id: "cold-chain-breach",
    title: "Cold-room telemetry and breach task",
    module: "Warehouse",
    icon: Snowflake,
    purpose: "Control temperature breaches before fruit quality loss becomes invisible inventory damage.",
    trigger: "Manual or integrated reading is outside location temperature range.",
    exitGate: "Breach is acknowledged, corrected, and resolved with notes.",
    erpHref: "/warehouse?tab=cold-chain",
    stakeholders: ["Warehouse operator", "QC", "Warehouse manager", "Maintenance"],
    handoff: "Operator records reading. QC assesses stock impact. Manager escalates. Maintenance fixes repeated room issues.",
    steps: [
      {
        title: "Record reading",
        owner: "Warehouse/QC",
        systemAction: "Submit temperature and humidity reading by warehouse/location.",
        control: "Out-of-range readings create breach tasks.",
      },
      {
        title: "Acknowledge or escalate",
        owner: "Warehouse manager",
        systemAction: "Acknowledge or escalate the task in cold-chain workspace.",
        control: "Open breach count remains visible until resolved.",
      },
      {
        title: "Resolve with corrective action",
        owner: "QC/manager",
        systemAction: "Enter resolution notes before closing the task.",
        control: "Resolution notes are mandatory.",
      },
    ],
    guardrails: [
      "Temperature breach cannot be closed silently.",
      "Affected lots should be moved to hold/quarantine where needed.",
      "Repeated breach patterns should trigger location maintenance review.",
    ],
  },
  {
    id: "receivables-credit-review",
    title: "Receivables and customer credit review",
    module: "Finance",
    icon: ClipboardCheck,
    purpose: "Keep credit exposure visible before sales keeps extending supply.",
    trigger: "Customer places repeat orders, crosses utilization bands, or hits credit review date.",
    exitGate: "Outstanding, overdue, collections, and risk band are reviewed with next action.",
    erpHref: "/receipts",
    stakeholders: ["Sales rep", "Finance", "Collections", "GM"],
    handoff: "Sales checks customer risk. Finance posts receipt. Collections follows overdue. GM approves exceptions.",
    steps: [
      {
        title: "Review customer exposure",
        owner: "Finance",
        systemAction: "Open customer page and review outstanding, overdue, utilization, and collection ratio.",
        control: "Risk bands flag watch/high/over-limit accounts.",
      },
      {
        title: "Post receipts",
        owner: "Finance",
        systemAction: "Record customer receipt and allocate against orders.",
        control: "Posted receipts update customer ledger and ageing.",
      },
      {
        title: "Hold or release",
        owner: "Finance/GM",
        systemAction: "Update credit hold with reason when exposure risk changes.",
        control: "Credit hold override trail remains visible on customer page.",
      },
    ],
    guardrails: [
      "Credit hold cannot change without reason.",
      "Overdue exposure must be visible before order approval.",
      "Collection trail must link back to order history.",
    ],
  },
  {
    id: "damage-return-credit",
    title: "Damage, return, and credit-note control",
    module: "Finance",
    icon: Recycle,
    purpose: "Prevent fruit returns and credits from becoming untraceable margin leakage.",
    trigger: "Customer rejects fruit, quality claim is raised, or credit note is requested.",
    exitGate: "Return disposition, dispute status, and finance document are linked to customer/order.",
    erpHref: "/finance",
    stakeholders: ["Customer", "Sales", "QC", "Warehouse", "Finance"],
    handoff: "Sales captures complaint. QC validates. Warehouse disposes/restocks. Finance issues approved credit.",
    steps: [
      {
        title: "Capture claim",
        owner: "Sales/QC",
        systemAction: "Create return or dispute with reason and customer/order reference.",
        control: "High-value disputes stay open until resolved.",
      },
      {
        title: "Decide disposition",
        owner: "QC/warehouse",
        systemAction: "Choose restock, wastage, dump, or credit action.",
        control: "Stock-affecting dispositions must be traceable.",
      },
      {
        title: "Issue finance document",
        owner: "Finance",
        systemAction: "Issue credit note only against approved source.",
        control: "Credit-note and return posting are role-restricted.",
      },
    ],
    guardrails: [
      "No high-value credit without dispute trail.",
      "No stock return without disposition.",
      "No credit note without finance authority.",
    ],
  },
  {
    id: "import-doc-readiness",
    title: "Import document readiness",
    module: "Import Docs",
    icon: PackageCheck,
    purpose: "Keep import container files complete before warehouse and finance decisions rely on them.",
    trigger: "New container is booked or shipping documents arrive.",
    exitGate: "Container has required document score and exception list is clear.",
    erpHref: "/documents",
    stakeholders: ["Docs team", "Clearing agent", "Finance", "Operations"],
    handoff: "Docs uploads file. Clearing verifies port data. Finance checks invoice values. Operations clears exceptions.",
    steps: [
      {
        title: "Attach documents",
        owner: "Docs team",
        systemAction: "Upload BL, invoice, packing list, COO, phytosanitary, and other required docs.",
        control: "Document completeness score remains visible on container.",
      },
      {
        title: "Verify references",
        owner: "Docs/finance",
        systemAction: "Check container no, BL no, supplier, currency, and invoice values.",
        control: "Container no and BL no remain searchable and cross-linked.",
      },
      {
        title: "Clear exceptions",
        owner: "Operations",
        systemAction: "Resolve missing or expiring documents before release gates.",
        control: "Alerts remain visible until resolved.",
      },
    ],
    guardrails: [
      "No orphan document without container/BL link.",
      "No silent document status changes.",
      "Container detail must show document completeness.",
    ],
  },
];
