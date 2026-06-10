"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock3, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AlertCategory } from "@/lib/data/notifications";

export function AlertActions({
  alertKey,
  category,
  compact = false,
}: {
  alertKey: string;
  category: AlertCategory;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function update(action: "read" | "snooze" | "resolve") {
    setBusy(action);
    try {
      const res = await fetch("/api/alerts/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertKey, category, action }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Could not update alert");
        return;
      }
      toast.success(
        action === "snooze"
          ? "Snoozed until tomorrow"
          : action === "resolve"
            ? "Resolved for you"
            : "Marked as read"
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size={compact ? "sm" : "default"}
        disabled={busy !== null}
        onClick={() => update("read")}
        className={compact ? "h-8 px-2 text-xs" : undefined}
      >
        <Eye className="h-3.5 w-3.5" /> Read
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={busy !== null}
        onClick={() => update("snooze")}
        className={compact ? "h-8 px-2 text-xs" : undefined}
      >
        <Clock3 className="h-3.5 w-3.5" /> Snooze
      </Button>
      <Button
        type="button"
        variant="success"
        size={compact ? "sm" : "default"}
        disabled={busy !== null}
        onClick={() => update("resolve")}
        className={compact ? "h-8 px-2 text-xs" : undefined}
      >
        <Check className="h-3.5 w-3.5" /> Resolve
      </Button>
    </div>
  );
}
