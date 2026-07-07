"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
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
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isSameNavigationRoute } from "@/lib/navigation";
import { can } from "@/lib/permissions";
import { BRAND_FULL_NAME, BRAND_SHORT_NAME } from "@/lib/branding";
import { useUiStore } from "@/store/useUiStore";
import type { NavCounts } from "@/lib/data/notifications";

type SidebarLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: keyof NavCounts;
};

type SidebarGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  links: SidebarLink[];
  visible: (role: string) => boolean;
};

const DIRECT_LINKS: SidebarLink[] = [
  { label: "Dashboards", href: "/", icon: LayoutDashboard },
  { label: "SOP Center", href: "/sop", icon: FileText },
];

const GROUPS: SidebarGroup[] = [
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

function badgeFor(link: SidebarLink, counts: NavCounts): number {
  if (link.badgeKey === "flaggedContainers") return counts.flaggedContainers;
  if (link.badgeKey === "expiringDocs") return counts.expiringDocs;
  if (link.badgeKey === "pendingPayments") return counts.pendingPayments;
  if (link.badgeKey === "totalAlerts") return counts.totalAlerts;
  return 0;
}

function NavLinks({
  counts,
  role,
  onNavigate,
}: {
  counts: NavCounts;
  role: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const autoOpen = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const group of GROUPS) {
      if (!group.visible(role)) continue;
      next[group.id] = group.links.some((link) => isSameNavigationRoute(pathname, searchParams, link.href));
    }
    return next;
  }, [pathname, role, searchParams]);

  function toggleGroup(id: string) {
    setOpenGroups((current) => ({
      ...current,
      [id]: !(current[id] ?? autoOpen[id]),
    }));
  }

  function isActive(href: string) {
    return isSameNavigationRoute(pathname, searchParams, href);
  }

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
      <div className="space-y-0.5">
        {DIRECT_LINKS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-100",
                active
                  ? "bg-white/10 text-white"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-white"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sky-300" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {GROUPS.filter((group) => group.visible(role)).map((group) => {
        const open = openGroups[group.id] ?? Boolean(autoOpen[group.id]);
        const groupActive = group.links.some((link) => isActive(link.href));

        return (
          <div key={group.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors duration-100",
                groupActive
                  ? "text-sidebar-foreground/90"
                  : "text-sidebar-muted hover:text-sidebar-foreground/80"
              )}
            >
              <span className="flex-1">{group.label}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  open && "rotate-180"
                )}
              />
            </button>

            {open && (
              <div className="space-y-0.5">
                {group.links.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const badge = badgeFor(item, counts);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-100",
                        active
                          ? "bg-white/10 text-white"
                          : "text-sidebar-muted hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sky-300" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span
                          className={cn(
                            "font-financial inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                            active ? "bg-white/20 text-white" : "bg-danger text-white"
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
        <Ship className="h-4 w-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="font-heading text-[15px] font-bold tracking-tight text-white">
          {BRAND_SHORT_NAME}
        </p>
        <p className="truncate text-[10px] text-sidebar-muted">Import Management System</p>
      </div>
    </div>
  );
}

export function Sidebar({ counts, role }: { counts: NavCounts; role: string }) {
  const { mobileSidebarOpen, closeMobileSidebar } = useUiStore();

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Brand />
        <NavLinks counts={counts} role={role} />
        <div className="border-t border-white/10 px-4 py-3 text-[10px] leading-relaxed text-sidebar-muted">
          {BRAND_FULL_NAME}
        </div>
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeMobileSidebar}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pr-3">
              <Brand />
              <button
                onClick={closeMobileSidebar}
                className="rounded p-1.5 text-sidebar-muted hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks counts={counts} role={role} onNavigate={closeMobileSidebar} />
          </aside>
        </div>
      )}
    </>
  );
}
