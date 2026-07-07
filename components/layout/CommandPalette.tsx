"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CreditCard,
  FileUp,
  Loader2,
  Package,
  Plus,
  Search,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { DIRECT_LINKS, GROUPS } from "@/components/layout/nav-config";
import { can } from "@/lib/permissions";
import { CONTAINER_STATUS_LABELS } from "@/lib/constants";
import type { ContainerStatus } from "@/types";

interface ContainerHit {
  id: string;
  containerNo: string;
  blNo: string;
  supplierName: string | null;
  status: ContainerStatus;
}

export function CommandPalette({
  role,
  open,
  onOpenChange,
}: {
  role: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContainerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Global Ctrl+K / Cmd+K shortcut.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  // Reset when closing.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  // Debounced live container / BL search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2 || !can(role, "container.view")) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/containers?q=${encodeURIComponent(q)}&limit=8`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { data: ContainerHit[] };
        setHits(body.data.slice(0, 8));
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setHits([]);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open, role]);

  const run = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  const q = query.trim().toLowerCase();

  const navItems = useMemo(() => {
    const direct = DIRECT_LINKS.map((link) => ({ ...link, group: "" }));
    const grouped = GROUPS.filter((group) => group.visible(role)).flatMap(
      (group) => group.links.map((link) => ({ ...link, group: group.label }))
    );
    const all = [...direct, ...grouped];
    if (!q) return all;
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [role, q]);

  const actions = useMemo(() => {
    const list = [
      {
        label: "New Container",
        href: "/containers/new",
        icon: Plus,
        allowed: can(role, "container.write"),
      },
      {
        label: "Upload Document",
        href: "/documents",
        icon: FileUp,
        allowed: can(role, "doc.write"),
      },
      {
        label: "Record Payment",
        href: "/payments",
        icon: CreditCard,
        allowed: can(role, "payment.write"),
      },
      {
        label: "Import from Excel",
        href: "/settings/import",
        icon: FileUp,
        allowed: ["admin", "gm", "manager"].includes(role),
      },
    ].filter((action) => action.allowed);
    if (!q) return list;
    return list.filter((action) => action.label.toLowerCase().includes(q));
  }, [role, q]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search containers, BL numbers, pages, actions…"
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Searching…" : "No results found."}
        </CommandEmpty>

        {(hits.length > 0 || (searching && q.length >= 2)) && (
          <CommandGroup heading="Containers">
            {searching && hits.length === 0 && (
              <CommandItem disabled value="__searching">
                <Loader2 className="animate-spin" />
                Searching containers…
              </CommandItem>
            )}
            {hits.map((hit) => (
              <CommandItem
                key={hit.id}
                value={`container-${hit.id}`}
                onSelect={() => run(`/containers/${hit.id}`)}
              >
                <Package />
                <span className="font-financial font-medium">{hit.containerNo}</span>
                <span className="truncate text-muted-foreground">
                  BL {hit.blNo}
                  {hit.supplierName ? ` · ${hit.supplierName}` : ""}
                </span>
                <CommandShortcut>
                  {CONTAINER_STATUS_LABELS[hit.status] ?? hit.status}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {q.length >= 2 && (
          <>
            <CommandGroup heading="Search">
              <CommandItem
                value="__search-everywhere"
                onSelect={() => run(`/search?q=${encodeURIComponent(query.trim())}`)}
              >
                <Search />
                Search everywhere for &ldquo;{query.trim()}&rdquo;
                <CommandShortcut>Enter</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.label}
                  value={`action-${action.label}`}
                  onSelect={() => run(action.href)}
                >
                  <Icon />
                  {action.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {navItems.length > 0 && (
          <CommandGroup heading="Go to">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={`${item.group}-${item.href}-${item.label}`}
                  value={`nav-${item.group}-${item.label}`}
                  onSelect={() => run(item.href)}
                >
                  <Icon />
                  {item.label}
                  {item.group && (
                    <span className="text-xs text-muted-foreground">
                      {item.group}
                    </span>
                  )}
                  <CommandShortcut>
                    <ArrowRight className="h-3 w-3" />
                  </CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
