// Shared application types for AIMS.

export type Role = "admin" | "manager" | "viewer";

export type ContainerStatus =
  | "Booked"
  | "InTransit"
  | "AtPort"
  | "CustomsClearance"
  | "Cleared"
  | "InWarehouse"
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

export type DocumentStatus = "Pending" | "Received" | "Verified" | "Expired";

export type PaymentStatus = "Pending" | "Partial" | "Paid";

export type Currency = "USD" | "AED" | "INR";

export interface AppUser {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  orgId: string;
}
