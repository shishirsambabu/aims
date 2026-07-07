"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTAINER_STATUSES, CONTAINER_STATUS_LABELS, PORTS } from "@/lib/constants";

interface SupplierOption {
  id: string;
  name: string;
}

const ALL = "__all__";

export function ContainerFilters({
  suppliers,
}: {
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const apply = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === ALL) params.delete(key);
        else params.set(key, value);
      }
      router.push(`/containers?${params.toString()}`);
    },
    [router, searchParams]
  );

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="relative min-w-[260px] flex-1"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Container No or BL No"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      <Select
        value={searchParams.get("port") ?? ALL}
        onValueChange={(v) => apply({ port: v })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Port" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All ports</SelectItem>
          {PORTS.map((p) => (
            <SelectItem key={p.code} value={p.name}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("supplierId") ?? ALL}
        onValueChange={(v) => apply({ supplierId: v })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Supplier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All suppliers</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("status") ?? ALL}
        onValueChange={(v) => apply({ status: v })}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {CONTAINER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {CONTAINER_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        type="date"
        value={searchParams.get("dateFrom") ?? ""}
        onChange={(e) => apply({ dateFrom: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="ETA from"
      />
      <span className="text-muted-foreground">-</span>
      <input
        type="date"
        value={searchParams.get("dateTo") ?? ""}
        onChange={(e) => apply({ dateTo: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="ETA to"
      />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push("/containers");
          }}
        >
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
