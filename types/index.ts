// Shared application types for AIMS.

export type Role =
  | "admin"
  | "manager"
  | "clearing_agent"
  | "finance"
  | "viewer"
  | "auditor";

export type ApprovalStatus =
  | "Draft"
  | "PendingApproval"
  | "Approved"
  | "Rejected";

export type ContainerStatus =
  | "Booked"
  | "InTransit"
  | "AtPort"
  | "CustomsClearance"
  | "Cleared"
  | "InWarehouse"
  | "EmptyReturned"
  | "PartiallySold"
  | "FullySold";

export type DocumentType =
  | "BillOfLading"
  | "CommercialInvoice"
  | "PackingList"
  | "BillOfEntry"
  | "CertificateOfOrigin"
  | "PhytosanitaryCertificate"
  | "Insurance"
  | "DeliveryOrder"
  | "Other";

export type DocumentStatus = "Pending" | "Uploaded" | "Verified" | "Expired";

export type PaymentStatus = "Pending" | "Partial" | "Paid";

export type Currency = "USD" | "AED" | "INR";

export interface AppUser {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  orgId: string;
}
