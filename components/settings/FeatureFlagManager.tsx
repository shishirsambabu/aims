"use client";

import { useState } from "react";
import { Flag, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FlagRow {
  key: string;
  enabled: boolean;
  description: string | null;
}

export function FeatureFlagManager({ initialFlags }: { initialFlags: FlagRow[] }) {
  const [flags, setFlags] = useState<FlagRow[]>(initialFlags);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newDescription, setNewDescription] = useState("");

  async function patchFlag(key: string, enabled: boolean, description?: string) {
    setBusyKey(key);
    try {
      const res = await fetch("/api/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled, description }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update flag");
        return false;
      }
      return true;
    } finally {
      setBusyKey(null);
    }
  }

  async function toggle(flag: FlagRow) {
    const next = !flag.enabled;
    const ok = await patchFlag(flag.key, next, flag.description ?? undefined);
    if (!ok) return;
    setFlags((current) =>
      current.map((f) => (f.key === flag.key ? { ...f, enabled: next } : f))
    );
    toast.success(`${flag.key} ${next ? "enabled" : "disabled"}`);
  }

  async function createFlag(e: React.FormEvent) {
    e.preventDefault();
    const key = newKey.trim().toLowerCase();
    if (!key) return;
    if (flags.some((f) => f.key === key)) {
      toast.error("A flag with this key already exists");
      return;
    }
    const ok = await patchFlag(key, false, newDescription.trim() || undefined);
    if (!ok) return;
    setFlags((current) =>
      [...current, { key, enabled: false, description: newDescription.trim() || null }].sort(
        (a, b) => a.key.localeCompare(b.key)
      )
    );
    setNewKey("");
    setNewDescription("");
    toast.success(`Flag "${key}" created (disabled)`);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardContent className="p-0">
          {flags.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No flags yet. Create one below — new flags start disabled.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {flags.map((flag) => (
                <li key={flag.key} className="flex items-center gap-3 px-5 py-3">
                  <Flag
                    className={cn(
                      "h-4 w-4 shrink-0",
                      flag.enabled ? "text-success" : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{flag.key}</p>
                    {flag.description && (
                      <p className="truncate text-[13px] text-muted-foreground">
                        {flag.description}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={flag.enabled ? "default" : "outline"}
                    disabled={busyKey === flag.key}
                    onClick={() => toggle(flag)}
                  >
                    {busyKey === flag.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : flag.enabled ? (
                      "Enabled"
                    ) : (
                      "Disabled"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-heading text-sm font-semibold">New flag</h3>
          <form onSubmit={createFlag} className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="flag_key (lowercase)"
              className="w-56 font-mono"
              pattern="[a-z0-9_.\-]+"
              title="Lowercase letters, digits, underscore, dot, hyphen"
            />
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What does this flag gate?"
              className="min-w-64 flex-1"
            />
            <Button type="submit" size="sm" disabled={!newKey.trim() || busyKey !== null}>
              <Plus className="h-4 w-4" /> Create
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            App version: <span className="font-mono">{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
