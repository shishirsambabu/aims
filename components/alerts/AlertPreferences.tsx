"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AlertPreference } from "@/lib/data/notifications";

export function AlertPreferences({
  preferences,
}: {
  preferences: AlertPreference[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function update(category: string, enabled: boolean) {
    setBusy(category);
    try {
      const res = await fetch("/api/alerts/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, enabled }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Could not update preference");
        return;
      }
      toast.success(enabled ? "Alert category enabled" : "Alert category hidden");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {preferences.map((p) => (
        <label
          key={p.category}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <span>{p.label}</span>
          <input
            type="checkbox"
            checked={p.enabled}
            disabled={busy === p.category}
            onChange={(e) => update(p.category, e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
      ))}
    </div>
  );
}
