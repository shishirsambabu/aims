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
import { DOCUMENT_TYPE_LABELS, REQUIRED_DOC_TYPES } from "@/lib/constants";

const ALL = "__all__";
const DOC_STATUSES = ["Pending", "Uploaded", "Verified", "Expired"] as const;

export function DocumentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const apply = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === ALL) params.delete(k);
        else params.set(k, v);
      }
      router.push(`/documents?${params.toString()}`);
    },
    [router, searchParams]
  );

  const expiring = searchParams.get("expiringSoon") === "1";
  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="relative min-w-[240px] flex-1"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Container No, BL No or Doc No…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </form>

      <Select
        value={searchParams.get("type") ?? ALL}
        onValueChange={(v) => apply({ type: v })}
      >
        <SelectTrigger className="w-[190px]">
          <SelectValue placeholder="Doc Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {REQUIRED_DOC_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("status") ?? ALL}
        onValueChange={(v) => apply({ status: v })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {DOC_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={expiring ? "default" : "outline"}
        size="sm"
        onClick={() => apply({ expiringSoon: expiring ? undefined : "1" })}
      >
        Expiring ≤ 30 days
      </Button>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push("/documents");
          }}
        >
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
