"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ship, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useUiStore } from "@/store/useUiStore";
import type { NavCounts } from "@/lib/data/notifications";

function badgeFor(href: string, counts: NavCounts): number {
  if (href === "/containers") return counts.flaggedContainers;
  if (href === "/documents") return counts.expiringDocs;
  if (href === "/payments") return counts.pendingPayments;
  if (href === "/alerts") return counts.totalAlerts;
  return 0;
}

function NavLinks({
  counts,
  onNavigate,
}: {
  counts: NavCounts;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        const badge = badgeFor(item.href, counts);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
              active
                ? "bg-gradient-to-r from-primary to-sky-500 text-white shadow-lg shadow-primary/25"
                : "text-sidebar-muted hover:bg-white/5 hover:text-white"
            )}
          >
            {active && (
              <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sky-300" />
            )}
            <Icon className="h-[18px] w-[18px]" />
            <span className="flex-1 uppercase tracking-wide text-[12px]">
              {item.label}
            </span>
            {badge > 0 && (
              <span
                className={cn(
                  "font-financial inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                  active ? "bg-white/20 text-white" : "bg-danger text-white"
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sky-200 shadow-lg shadow-black/20 ring-1 ring-white/15">
        <Ship className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="font-heading text-lg font-bold tracking-tight">AIMS</p>
        <p className="text-[11px] text-sidebar-muted">Aeden Imports</p>
      </div>
    </div>
  );
}

export function Sidebar({ counts }: { counts: NavCounts }) {
  const { mobileSidebarOpen, closeMobileSidebar } = useUiStore();

  return (
    <>
      <aside className="mesh-panel hidden w-64 shrink-0 flex-col text-white md:flex">
        <Brand />
        <NavLinks counts={counts} />
        <div className="m-4 rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-[11px] text-sky-100/75 shadow-2xl shadow-black/20 backdrop-blur">
          <p className="font-heading text-sm font-semibold text-white">
            Aeden Imports Management System
          </p>
          <p className="mt-1">Operations command center</p>
        </div>
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeMobileSidebar}
          />
          <aside className="mesh-panel absolute left-0 top-0 flex h-full w-72 flex-col text-white shadow-xl">
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
            <NavLinks counts={counts} onNavigate={closeMobileSidebar} />
          </aside>
        </div>
      )}
    </>
  );
}
