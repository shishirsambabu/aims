import {
  BarChart3,
  Bell,
  Coins,
  CreditCard,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Package,
  Ship,
  ShoppingCart,
  Settings,
  ShipWheel,
  Users2,
  UserRound,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { can } from "@/lib/permissions";
import type { NavCounts } from "@/lib/data/notifications";

export type SidebarLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: keyof NavCounts;
};

export type SidebarGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  links: SidebarLink[];
  visible: (role: string) => boolean;
};

export const DIRECT_LINKS: SidebarLink[] = [
  { label: "Dashboards", href: "/", icon: LayoutDashboard },
  { label: "SOP Center", href: "/sop", icon: FileText },
];

export const GROUPS: SidebarGroup[] = [
  {
    id: "import-docs",
    label: "Import Docs",
    icon: Package,
    visible: (role) => can(role, "container.write") || can(role, "doc.write") || can(role, "inventory.view") || ["admin", "gm", "manager"].includes(role),
    links: [
      { label: "Containers", href: "/containers", icon: Package, badgeKey: "flaggedContainers" },
      { label: "Shipments", href: "/shipments", icon: Ship },
      { label: "Documents", href: "/documents", icon: FileText, badgeKey: "expiringDocs" },
    ],
  },
  {
    id: "procurement",
    label: "Procurement",
    icon: FileSpreadsheet,
    visible: (role) => ["admin", "gm", "manager"].includes(role),
    links: [
      { label: "Procurement", href: "/procurement", icon: FileSpreadsheet },
    ],
  },
  {
    id: "core-sales",
    label: "Sales",
    icon: ShoppingCart,
    visible: (role) => can(role, "sales.view"),
    links: [
      { label: "Sales Module", href: "/sales", icon: ShoppingCart },
      { label: "Quotes", href: "/quotes", icon: FileSpreadsheet },
      { label: "Orders", href: "/orders", icon: ShoppingCart },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: Users2,
    visible: (role) => can(role, "crm.view"),
    links: [
      { label: "CRM Pipeline", href: "/crm", icon: Users2 },
      { label: "Customers", href: "/customers", icon: UserRound },
    ],
  },
  {
    id: "warehouse",
    label: "Warehouse",
    icon: Warehouse,
    visible: (role) => can(role, "inventory.view"),
    links: [
      { label: "Inward", href: "/warehouse", icon: Warehouse },
      { label: "Grading / Packing", href: "/warehouse?tab=processing", icon: FileBarChart },
      { label: "Outward", href: "/warehouse?tab=outward", icon: ShipWheel },
    ],
  },
  {
    id: "finance",
    label: "Finance and Control",
    icon: CreditCard,
    visible: (role) => can(role, "financials.view") || can(role, "receipts.view") || can(role, "payment.write"),
    links: [
      { label: "Finance Module", href: "/finance", icon: CreditCard },
      { label: "Payments", href: "/payments", icon: CreditCard, badgeKey: "pendingPayments" },
      { label: "Receipts", href: "/receipts", icon: Coins },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Reports", href: "/reports", icon: FileBarChart },
      { label: "Alerts", href: "/alerts", icon: Bell, badgeKey: "totalAlerts" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Settings,
    visible: (role) => ["admin", "gm", "manager"].includes(role) || can(role, "team.manage") || can(role, "masterdata.write") || can(role, "integration.manage"),
    links: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Team", href: "/settings/team", icon: Users2 },
      { label: "Warehouses", href: "/settings/warehouses", icon: Warehouse },
      { label: "Suppliers", href: "/settings/suppliers", icon: Package },
    ],
  },
];
