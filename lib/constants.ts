import {
  LayoutDashboard,
  Package,
  Ship,
  FileText,
  CreditCard,
  BarChart3,
  FileBarChart,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { ContainerStatus, DocumentType } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Containers", href: "/containers", icon: Package },
  { label: "Shipments", href: "/shipments", icon: Ship },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

// Container status pipeline, in order.
export const CONTAINER_STATUSES: ContainerStatus[] = [
  "Booked",
  "InTransit",
  "AtPort",
  "CustomsClearance",
  "Cleared",
  "InWarehouse",
  "EmptyReturned",
  "PartiallySold",
  "FullySold",
];

export const CONTAINER_STATUS_LABELS: Record<ContainerStatus, string> = {
  Booked: "Booked",
  InTransit: "In Transit",
  AtPort: "At Port",
  CustomsClearance: "Customs Clearance",
  Cleared: "Cleared",
  InWarehouse: "In Warehouse",
  EmptyReturned: "Empty Returned",
  PartiallySold: "Partially Sold",
  FullySold: "Fully Sold",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  BillOfLading: "Bill of Lading",
  CommercialInvoice: "Commercial Invoice",
  PackingList: "Packing List",
  BillOfEntry: "Bill of Entry",
  CertificateOfOrigin: "Certificate of Origin",
  PhytosanitaryCertificate: "Phytosanitary Certificate",
  Insurance: "Insurance",
  DeliveryOrder: "Delivery Order",
  Other: "Other",
};

// The 9 documents that make up a complete container dossier.
export const REQUIRED_DOC_TYPES: DocumentType[] = [
  "BillOfLading",
  "CommercialInvoice",
  "PackingList",
  "BillOfEntry",
  "CertificateOfOrigin",
  "PhytosanitaryCertificate",
  "Insurance",
  "DeliveryOrder",
  "Other",
];

export const PORTS = [
  { name: "Bangalore", code: "INENR1" },
  { name: "Mumbai", code: "INNSA1" },
  { name: "Kochi", code: "INCOK1" },
  { name: "Kochi (Air)", code: "INMAA1" },
];

export const CUSTOMERS = ["AEDEN", "NKA"];

// Supabase Storage bucket for document files.
export const STORAGE_BUCKET = "aims-documents";

// Max upload size (25 MB) and accepted file types.
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

export const SUPPLIERS = [
  "COSMOS GROUP",
  "BASSTION FRUIT",
  "AGRO CITY IMPORT & EXPORT",
  "FRESHGOLD SA EXPORTS",
  "UNITED EXPORTS LIMITED",
  "DELTA AGRAR DOO",
  "QINGDAO BLUE BOAT",
  "EVERFRESH AGRICULTURAL TECHNOLOGY",
  "SNAZZY FRUIT COMPANY",
];
