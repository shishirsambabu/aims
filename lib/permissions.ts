// AIMS role-based access control. A single capability matrix that both the API
// (enforcement) and the UI (what to show) consult.

import type { Role } from "@/types";

export type Capability =
  | "container.view"
  | "container.write"
  | "warehouse.assign"
  | "warehouse.receive"
  | "warehouse.adjust"
  | "warehouse.fulfil"
  | "warehouse.count.approve"
  | "inventory.view"
  | "cost.write"
  | "cost.finalize"
  | "cost.unlock"
  | "price.publish"
  | "price.override.approve"
  | "price.floor.view"
  | "crm.view"
  | "crm.write"
  | "crm.kyc.approve"
  | "sale.write"
  | "sale.approve"
  | "salesorder.write"
  | "salesorder.approve"
  | "sales.view"
  | "receipts.view"
  | "invoice.issue"
  | "creditnote.issue"
  | "return.post"
  | "bank.reconcile"
  | "journal.post"
  | "finance.close"
  | "dispute.manage"
  | "coldchain.manage"
  | "doc.view"
  | "doc.write"
  | "doc.verify"
  | "payment.write"
  | "payment.view"
  | "payment.approve"
  | "payment.pay"
  | "receipt.record"
  | "import"
  | "team.manage"
  | "masterdata.write"
  | "masterdata.approve"
  | "integration.manage"
  | "audit.view"
  | "financials.view";

export const ALL_ROLES: Role[] = [
  "admin",
  "gm",
  "manager",
  "sales_executive",
  "warehouse",
  "finance",
  "viewer",
  "auditor",
  "clearing_agent",
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  gm: "GM",
  manager: "Manager",
  sales_executive: "Sales Executive",
  warehouse: "Warehouse",
  clearing_agent: "Clearing Agent",
  finance: "Finance",
  viewer: "Viewer",
  auditor: "Auditor",
};

const MATRIX: Record<Role, Capability[]> = {
  admin: [
    "container.view",
    "container.write",
    "warehouse.assign",
    "warehouse.receive",
    "warehouse.adjust",
    "warehouse.fulfil",
    "warehouse.count.approve",
    "inventory.view",
    "cost.write",
    "cost.finalize",
    "cost.unlock",
    "price.publish",
    "price.override.approve",
    "price.floor.view",
    "crm.view",
    "crm.write",
    "crm.kyc.approve",
    "sale.write",
    "sale.approve",
    "salesorder.write",
    "salesorder.approve",
    "sales.view",
    "receipts.view",
    "invoice.issue",
    "creditnote.issue",
    "return.post",
    "bank.reconcile",
    "journal.post",
    "finance.close",
    "dispute.manage",
    "coldchain.manage",
    "doc.view",
    "doc.write",
    "doc.verify",
    "payment.write",
    "payment.view",
    "payment.approve",
    "payment.pay",
    "receipt.record",
    "import",
    "team.manage",
    "masterdata.write",
    "masterdata.approve",
    "integration.manage",
    "audit.view",
    "financials.view",
  ],
  gm: [
    "container.view",
    "container.write",
    "warehouse.assign",
    "warehouse.receive",
    "warehouse.adjust",
    "warehouse.fulfil",
    "warehouse.count.approve",
    "inventory.view",
    "cost.write",
    "cost.finalize",
    "cost.unlock",
    "price.publish",
    "price.override.approve",
    "price.floor.view",
    "crm.view",
    "crm.write",
    "crm.kyc.approve",
    "sale.write",
    "sale.approve",
    "salesorder.write",
    "salesorder.approve",
    "sales.view",
    "receipts.view",
    "invoice.issue",
    "creditnote.issue",
    "return.post",
    "bank.reconcile",
    "journal.post",
    "finance.close",
    "dispute.manage",
    "coldchain.manage",
    "doc.view",
    "doc.write",
    "doc.verify",
    "payment.write",
    "payment.view",
    "payment.approve",
    "payment.pay",
    "receipt.record",
    "import",
    "masterdata.write",
    "masterdata.approve",
    "integration.manage",
    "audit.view",
    "financials.view",
  ],
  manager: [
    "container.view",
    "container.write",
    "warehouse.assign",
    "warehouse.receive",
    "warehouse.adjust",
    "warehouse.fulfil",
    "warehouse.count.approve",
    "inventory.view",
    "crm.write",
    "crm.view",
    "crm.kyc.approve",
    "sale.write",
    "sale.approve",
    "salesorder.write",
    "salesorder.approve",
    "sales.view",
    "receipts.view",
    "invoice.issue",
    "creditnote.issue",
    "return.post",
    "bank.reconcile",
    "journal.post",
    "finance.close",
    "dispute.manage",
    "coldchain.manage",
    "doc.view",
    "doc.write",
    "doc.verify",
    "payment.write",
    "payment.view",
    "payment.approve",
    "payment.pay",
    "receipt.record",
    "import",
    "masterdata.write",
    "masterdata.approve",
    "audit.view",
  ],
  sales_executive: [
    "container.view",
    "inventory.view",
    "crm.write",
    "crm.view",
    "sale.write",
    "salesorder.write",
    "sales.view",
    "receipts.view",
    "doc.view",
    "doc.write",
    "receipt.record",
  ],
  warehouse: [
    "container.view",
    "container.write",
    "warehouse.assign",
    "warehouse.receive",
    "warehouse.adjust",
    "warehouse.fulfil",
    "coldchain.manage",
    "inventory.view",
    "doc.view",
    "doc.write",
    "doc.verify",
  ],
  clearing_agent: [
    "container.view",
    "container.write",
    "doc.view",
    "doc.write",
    "doc.verify",
  ],
  finance: [
    "container.view",
    "inventory.view",
    "doc.view",
    "cost.write",
    "cost.finalize",
    "cost.unlock",
    "price.floor.view",
    "sale.write",
    "sale.approve",
    "salesorder.write",
    "salesorder.approve",
    "sales.view",
    "receipts.view",
    "invoice.issue",
    "creditnote.issue",
    "return.post",
    "bank.reconcile",
    "journal.post",
    "finance.close",
    "dispute.manage",
    "payment.write",
    "payment.view",
    "payment.approve",
    "payment.pay",
    "receipt.record",
    "import",
    "audit.view",
    "financials.view",
  ],
  viewer: ["container.view", "inventory.view", "doc.view"],
  auditor: ["container.view", "payment.view", "audit.view", "financials.view", "inventory.view", "crm.view", "sales.view", "receipts.view", "doc.view"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as string[]).includes(value);
}

export function normalizeRole(role: Role | string | undefined): Role | undefined {
  if (!role || !isRole(role)) return undefined;
  return role;
}

export function can(role: Role | string | undefined, cap: Capability): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return (MATRIX[normalized] ?? []).includes(cap);
}

export function canAny(
  role: Role | string | undefined,
  capabilities: Capability[]
): boolean {
  return capabilities.some((capability) => can(role, capability));
}

export function canViewFinancials(role: Role | string | undefined): boolean {
  return can(role, "financials.view");
}
