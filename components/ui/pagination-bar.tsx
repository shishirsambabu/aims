"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

interface PaginationBarProps {
  total: number;
  page: number;
  pageSize?: number;
  className?: string;
  /** Noun for the count line, e.g. "containers". */
  itemLabel?: string;
}

/** URL-driven pagination footer: preserves all other query params. */
export function PaginationBar({
  total,
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  className,
  itemLabel = "rows",
}: PaginationBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);

  const goTo = useCallback(
    (target: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (target <= 1) params.delete("page");
      else params.set("page", String(target));
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  if (total === 0) return null;

  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  // Compact page list: 1 … c-1 c c+1 … n
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - current) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3",
        className
      )}
    >
      <p className="text-[13px] text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from.toLocaleString("en-IN")}</span>
        –<span className="font-medium text-foreground">{to.toLocaleString("en-IN")}</span> of{" "}
        <span className="font-medium text-foreground">{total.toLocaleString("en-IN")}</span> {itemLabel}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={current <= 1}
            onClick={() => goTo(current - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === current ? "secondary" : "ghost"}
                size="sm"
                className={cn("min-w-8 px-2", p === current && "font-semibold")}
                onClick={() => goTo(p)}
                aria-current={p === current ? "page" : undefined}
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={current >= pageCount}
            onClick={() => goTo(current + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
