"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, LogOut, ChevronRight, Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { useUiStore } from "@/store/useUiStore";
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
  const router = useRouter();
  const toggleMobileSidebar = useUiStore((s) => s.toggleMobileSidebar);
  const [query, setQuery] = useState("");

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Search spans Container No AND BL No on the containers list.
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

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

      {/* Global search */}
      <form onSubmit={handleSearch} className="ml-auto w-full max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Container No or BL No…"
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-[13px] outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </form>

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
