"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, LogOut, ChevronRight, Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { useUiStore } from "@/store/useUiStore";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS, isRole } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopNavProps {
  user: {
    email: string;
    fullName: string | null;
    role: string;
  };
}

function initials(name: string | null, email: string) {
  const base = name?.trim() || email;
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export function TopNav({ user }: TopNavProps) {
  const pathname = usePathname();
  const toggleMobileSidebar = useUiStore((s) => s.toggleMobileSidebar);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const SEGMENT_LABELS: Record<string, string> = {
    containers: "Containers",
    shipments: "Shipments",
    documents: "Documents",
    payments: "Payments",
    receipts: "Receipts",
    analytics: "Analytics",
    reports: "Reports",
    exports: "Export Center",
    alerts: "Alerts",
    settings: "Settings",
    team: "Team",
    suppliers: "Suppliers",
    warehouses: "Warehouses",
    warehouse: "Warehouse",
    templates: "Templates",
    procurement: "Procurement",
    sales: "Sales",
    quotes: "Quotes",
    orders: "Orders",
    crm: "CRM",
    customers: "Customers",
    finance: "Finance",
    sop: "SOP Center",
    search: "Search",
    audit: "Audit Log",
    import: "Excel Import",
    integrations: "Integrations",
    "document-automation": "Document Automation",
    new: "New",
  };

  const segments = pathname.split("/").filter(Boolean);
  const crumbs =
    segments.length === 0
      ? ["Dashboard"]
      : segments.map((segment) =>
          SEGMENT_LABELS[segment] ??
          (/^[0-9a-f-]{16,}$/i.test(segment) ? "Detail" : segment)
        );

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4 md:px-6">
      {/* Mobile menu toggle */}
      <button
        onClick={toggleMobileSidebar}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-alt md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb */}
      <nav className="hidden items-center gap-1 text-[13px] text-muted-foreground sm:flex">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            <span
              className={cn(
                i === crumbs.length - 1 && "font-medium text-foreground"
              )}
            >
              {c}
            </span>
          </span>
        ))}
      </nav>

      {/* Global search — opens the command palette */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="ml-auto flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          Search containers, pages, actions…
        </span>
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-flex">
          Ctrl K
        </kbd>
      </button>

      <CommandPalette
        role={user.role}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />

      <ThemeToggle />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar>
            <AvatarFallback>
              {initials(user.fullName, user.email).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="truncate text-sm font-medium">
                {user.fullName || user.email}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
              <span className="mt-1 inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary">
                {isRole(user.role) ? ROLE_LABELS[user.role] : user.role}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={signOut}>
            <button type="submit" className="w-full">
              <DropdownMenuItem className="text-danger focus:text-danger">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
