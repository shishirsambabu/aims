"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Plug,
  RefreshCw,
  ShieldCheck,
  TestTube2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";

type IntegrationRun = {
  id: string;
  status: string;
  mode: string;
  summary: string | null;
  createdAt: string | Date;
  startedAt: string | Date | null;
  finishedAt: string | Date | null;
};

type IntegrationConnection = {
  id: string;
  provider: string;
  name: string;
  status: string;
  config: unknown;
  lastSyncAt: string | Date | null;
  lastTestAt: string | Date | null;
  errorMessage: string | null;
  runs: IntegrationRun[];
  errors: {
    id: string;
    message: string;
    severity: string;
    createdAt: string | Date;
  }[];
};

type ExternalReferenceRow = {
  id: string;
  provider: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  externalId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

const PROVIDERS = [
  {
    key: "outlook",
    label: "Outlook / Microsoft Graph",
    description: "Use for email ingestion, scheduled reports, and mailbox automation.",
  },
  {
    key: "tally",
    label: "Tally",
    description: "Push ledgers, receipts, and voucher summaries to accounting.",
  },
  {
    key: "icegate",
    label: "ICEGATE",
    description: "Future customs-status sync and document handoff integration.",
  },
  {
    key: "carrier",
    label: "Carrier / WMS",
    description: "Warehouse or carrier events, dispatch notices, and inventory sync.",
  },
  {
    key: "ocr",
    label: "OCR Provider",
    description: "Document extraction for invoices, BOE, delivery orders, and claims.",
  },
  {
    key: "email",
    label: "Email Bridge",
    description: "Fallback mailbox-to-document ingestion path.",
  },
] as const;

const STATUS_OPTIONS = ["NotConnected", "NeedsKeys", "Connected", "Paused"] as const;
const ENTITY_TYPES = [
  "container",
  "warehouse",
  "customer",
  "sales_order",
  "customer_receipt",
] as const;

export function IntegrationsWorkspace({
  initialConnections,
}: {
  initialConnections: IntegrationConnection[];
}) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [refs, setRefs] = useState<ExternalReferenceRow[]>([]);
  const [refsBusy, setRefsBusy] = useState(false);
  const [refSaving, setRefSaving] = useState(false);
  const [form, setForm] = useState({
    provider: "carrier",
    name: "Warehouse / ERP Bridge",
    status: "NeedsKeys",
    config: JSON.stringify(
      {
        endpoint: "",
        webhookSecret: "",
        notes: "Use this connection to sync stock, dispatch and receipts with the warehouse system.",
      },
      null,
      2
    ),
  });
  const [refForm, setRefForm] = useState({
    provider: "carrier",
    entityType: "container",
    entityKey: "",
    externalId: "",
    metadata: JSON.stringify(
      {
        warehouseCode: "",
        externalWarehouseCode: "",
        syncScope: "pilot",
      },
      null,
      2
    ),
  });
  const [selectedProvider, setSelectedProvider] = useState("carrier");

  const selectedConnection = useMemo(
    () => connections.find((row) => row.provider === selectedProvider) ?? null,
    [connections, selectedProvider]
  );

  useEffect(() => {
    void reloadRefs();
  }, []);

  async function saveConnection() {
    setSaving(true);
    try {
      let config: unknown = undefined;
      try {
        config = form.config.trim() ? JSON.parse(form.config) : undefined;
      } catch {
        toast.error("Config must be valid JSON");
        return;
      }

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          name: form.name,
          status: form.status,
          config,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save integration");
        return;
      }
      toast.success("Integration saved");
      await reload();
      setSelectedProvider(form.provider);
    } finally {
      setSaving(false);
    }
  }

  async function runConnection(id: string, mode: "TestConnection" | "DryRun" | "Manual") {
    setRunningId(id);
    try {
      const res = await fetch(`/api/integrations/${id}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to start run");
        return;
      }
      toast.success(mode === "TestConnection" ? "Connection test recorded" : "Run recorded");
      await reload();
    } finally {
      setRunningId(null);
    }
  }

  async function reload() {
    const res = await fetch("/api/integrations");
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to refresh integrations");
      return;
    }
    setConnections(json.data as IntegrationConnection[]);
    router.refresh();
  }

  async function reloadRefs() {
    setRefsBusy(true);
    try {
      const res = await fetch("/api/external-references");
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to load mappings");
        return;
      }
      setRefs(json.data as ExternalReferenceRow[]);
    } finally {
      setRefsBusy(false);
    }
  }

  async function saveReference() {
    setRefSaving(true);
    try {
      let metadata: unknown = undefined;
      try {
        metadata = refForm.metadata.trim() ? JSON.parse(refForm.metadata) : undefined;
      } catch {
        toast.error("Mapping metadata must be valid JSON");
        return;
      }
      const res = await fetch("/api/external-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: refForm.provider,
          entityType: refForm.entityType,
          entityKey: refForm.entityKey,
          externalId: refForm.externalId,
          metadata,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save mapping");
        return;
      }
      toast.success("Mapping saved");
      setRefForm((current) => ({
        ...current,
        entityKey: "",
        externalId: "",
      }));
      await reloadRefs();
    } finally {
      setRefSaving(false);
    }
  }

  async function deleteReference(id: string) {
    const res = await fetch(`/api/external-references/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to delete mapping");
      return;
    }
    toast.success("Mapping deleted");
    await reloadRefs();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Connections" value={connections.length.toString()} />
        <Metric
          label="Connected"
          value={connections.filter((row) => row.status === "Connected").length.toString()}
        />
        <Metric
          label="Need Keys"
          value={connections.filter((row) => row.status === "NeedsKeys").length.toString()}
        />
        <Metric
          label="Recent Errors"
          value={connections.reduce((sum, row) => sum + row.errors.length, 0).toString()}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Plug className="h-5 w-5" />
              </div>
              <div>
                <p className="label-caps">Setup</p>
                <h3 className="font-heading text-lg font-semibold">Configure a bridge</h3>
                <p className="text-sm text-muted-foreground">
                  Start with a carrier or WMS bridge, then expand to Tally and Outlook.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Provider">
                <Select
                  value={form.provider}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      provider: value,
                      name:
                        value === "carrier"
                          ? "Warehouse / ERP Bridge"
                          : value === "outlook"
                            ? "Mail / Inbox Bridge"
                            : value === "tally"
                              ? "Finance Bridge"
                              : current.name,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.key} value={provider.key}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>

              <Field label="Status">
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Config JSON">
                <Textarea
                  rows={12}
                  value={form.config}
                  onChange={(e) => setForm({ ...form, config: e.target.value })}
                  className="font-mono text-xs"
                />
              </Field>

              <div className="rounded-xl border border-border bg-surface-alt/40 p-3 text-xs text-muted-foreground">
                For a warehouse system, keep the payload narrow at first: container no, BL no, warehouse code, stock lots, dispatch events, and receipt references.
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => router.refresh()}>
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
                <Button onClick={saveConnection} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Connection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <EmptyState
                  icon={ShieldCheck}
                  title="No integrations configured yet"
                  description="Create the first bridge to your warehouse system, accounting package, or mailbox."
                  className="border-0 bg-transparent"
                />
              </CardContent>
            </Card>
          ) : (
            connections.map((row) => {
              const latestRun = row.runs[0];
              return (
                <Card key={row.id} className={cn(selectedProvider === row.provider && "border-primary/40")}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedProvider(row.provider)}
                        className="text-left"
                      >
                        <p className="label-caps">{row.provider}</p>
                        <h3 className="font-heading text-base font-semibold">{row.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {PROVIDERS.find((provider) => provider.key === row.provider)?.description ?? ""}
                        </p>
                      </button>
                      <Badge variant={badgeVariant(row.status)}>{row.status}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3 rounded-xl border border-border bg-surface-alt/40 p-3 text-sm sm:grid-cols-3">
                      <Meta label="Last sync" value={formatDate(row.lastSyncAt)} />
                      <Meta label="Last test" value={formatDate(row.lastTestAt)} />
                      <Meta label="Latest run" value={latestRun ? `${latestRun.status} · ${latestRun.mode}` : "No runs"} />
                    </div>

                    {row.errorMessage && (
                      <div className="mt-3 flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9A6212]" />
                        <span className="text-muted-foreground">{row.errorMessage}</span>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runConnection(row.id, "TestConnection")}
                        disabled={runningId === row.id}
                      >
                        <TestTube2 className="h-4 w-4" /> Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runConnection(row.id, "DryRun")}
                        disabled={runningId === row.id}
                      >
                        <ArrowRight className="h-4 w-4" /> Dry Run
                      </Button>
                    </div>

                    {row.errors.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Recent errors
                        </p>
                        {row.errors.map((error) => (
                          <div key={error.id} className="rounded-lg border border-border p-2 text-xs">
                            <p className="font-medium">{error.severity}</p>
                            <p className="text-muted-foreground">{error.message}</p>
                            <p className="text-muted-foreground">{formatDate(error.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {selectedConnection && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label-caps">Selected Bridge</p>
                <h3 className="font-heading text-lg font-semibold">{selectedConnection.name}</h3>
              </div>
              <Badge variant={badgeVariant(selectedConnection.status)}>{selectedConnection.status}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selectedConnection.runs.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No runs yet"
                  description="Run a test or dry-run to create the first integration trail."
                  className="border-0 bg-transparent py-6"
                />
              ) : (
                selectedConnection.runs.map((run) => (
                  <div key={run.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{run.mode}</p>
                      <Badge variant={badgeVariant(run.status)}>{run.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{run.summary ?? "No summary"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(run.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">External References</p>
              <h3 className="font-heading text-lg font-semibold">
                Local record to external ID map
              </h3>
              <p className="text-sm text-muted-foreground">
                This is the glue between AIMS and a warehouse system or ERP. Start with container mappings, then extend to warehouses and customers.
              </p>
            </div>
            <Button variant="outline" onClick={() => void reloadRefs()} disabled={refsBusy}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4 rounded-lg border border-border bg-surface-alt/30 p-4">
              <Field label="Provider">
                <Select
                  value={refForm.provider}
                  onValueChange={(value) => setRefForm({ ...refForm, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.key} value={provider.key}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Entity Type">
                <Select
                  value={refForm.entityType}
                  onValueChange={(value) => setRefForm({ ...refForm, entityType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Local Key">
                <Input
                  value={refForm.entityKey}
                  onChange={(e) => setRefForm({ ...refForm, entityKey: e.target.value })}
                  placeholder="Container No, BL No, code or internal ID"
                />
              </Field>
              <Field label="External ID">
                <Input
                  value={refForm.externalId}
                  onChange={(e) => setRefForm({ ...refForm, externalId: e.target.value })}
                  placeholder="WMS / ERP reference"
                />
              </Field>
              <Field label="Metadata JSON">
                <Textarea
                  rows={8}
                  value={refForm.metadata}
                  onChange={(e) => setRefForm({ ...refForm, metadata: e.target.value })}
                  className="font-mono text-xs"
                />
              </Field>
              <div className="flex justify-end">
                <Button onClick={saveReference} disabled={refSaving}>
                  {refSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Mapping
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {refsBusy ? (
                <div className="flex min-h-[280px] items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : refs.length === 0 ? (
                <Card>
                  <CardContent className="py-6">
                    <EmptyState
                      icon={ShieldCheck}
                      title="No external mappings yet"
                      description="Map a container or warehouse to its external WMS/ERP ID to start sync-ready tracking."
                      className="border-0 bg-transparent"
                    />
                  </CardContent>
                </Card>
              ) : (
                refs.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {row.provider} · {row.entityType}
                        </p>
                        <h4 className="font-medium">{row.entityLabel}</h4>
                        <p className="font-financial text-sm text-muted-foreground">
                          External ID: {row.externalId}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void deleteReference(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                    {row.metadata && (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-alt/60 p-3 text-[11px] text-muted-foreground">
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-t-4 border-t-primary">
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-financial mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

function badgeVariant(value: string) {
  if (value === "Connected") return "success";
  if (value === "Paused" || value === "Blocked" || value === "Error") return "danger";
  if (value === "NeedsKeys" || value === "Queued") return "warning";
  return "secondary";
}
