"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PORTS } from "@/lib/constants";

const ALL = "__all__";

export function ShipmentFilters({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apply = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === ALL) params.delete(k);
        else params.set(k, v);
      }
      router.push(`/shipments?${params.toString()}`);
    },
    [router, searchParams]
  );

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={searchParams.get("port") ?? ALL}
        onValueChange={(v) => apply({ port: v })}
      >
        <SelectTrigger className="w-[160px]">
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
        <SelectTrigger className="w-[190px]">
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

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/shipments")}>
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
