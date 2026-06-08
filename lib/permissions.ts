// AIMS role-based access control. A single capability matrix that both the API
// (enforcement) and the UI (what to show) consult.

import type { Role } from "@/types";

export type Capability =
  | "container.write" // create/edit containers, change status
  | "cost.write" // edit landing costs
  | "cost.finalize" // lock a cost sheet
  | "cost.unlock" // re-open a finalized cost sheet
  | "sale.write" // edit sales
  | "doc.write" // upload documents
  | "doc.verify" // mark a document verified
  | "payment.write" // raise a payment request (maker)
  | "payment.approve" // approve a payment request (checker)
  | "payment.pay" // record a payment / mark paid
  | "import" // bulk Excel import
  | "team.manage" // manage members & roles
  | "audit.view" // view the audit log
  | "financials.view"; // see cost / profit / payment figures

const MATRIX: Record<Role, Capability[]> = {
  admin: [
    "container.write", "cost.write", "cost.finalize", "cost.unlock",
    "sale.write", "doc.write", "doc.verify", "payment.write",
    "payment.approve", "payment.pay", "import", "team.manage",
    "audit.view", "financials.view",
  ],
  manager: [
    "container.write", "cost.write", "cost.finalize", "cost.unlock",
    "sale.write", "doc.write", "doc.verify", "payment.write",
    "payment.approve", "payment.pay", "import", "audit.view",
    "financials.view",
  ],
  clearing_agent: ["container.write", "doc.write", "doc.verify"],
  finance: [
    "cost.write", "cost.finalize", "sale.write", "payment.write",
    "payment.approve", "payment.pay", "import", "financials.view",
  ],
  viewer: [],
  auditor: ["audit.view", "financials.view"],
};

export function can(role: Role | string | undefined, cap: Capability): boolean {
  if (!role) return false;
  return (MATRIX[role as Role] ?? []).includes(cap);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  clearing_agent: "Clearing Agent",
  finance: "Finance",
  viewer: "Viewer",
  auditor: "Auditor",
};

export const ALL_ROLES: Role[] = [
  "admin",
  "manager",
  "clearing_agent",
  "finance",
  "viewer",
  "auditor",
];
