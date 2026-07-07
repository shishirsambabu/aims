"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReportFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.push(`/reports?${params.toString()}`);
  }

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">ETA between</span>
      <input
        type="date"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => apply({ from: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="From"
      />
      <span className="text-muted-foreground">-</span>
      <input
        type="date"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => apply({ to: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="To"
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/reports")}>
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
