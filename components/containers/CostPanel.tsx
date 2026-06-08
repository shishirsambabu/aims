"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";
import { computeCost, type CostInputs } from "@/lib/finance";

const FIELDS: { key: keyof CostInputs; label: string }[] = [
  { key: "beInvoiceValueInr", label: "BE Invoice Value (INR)" },
  { key: "customsDuty", label: "Customs Duty" },
  { key: "clearingCharges", label: "Clearing Charges" },
  { key: "linerCharges", label: "Liner Charges" },
  { key: "detention", label: "Detention" },
  { key: "chaCharges", label: "CHA Charges" },
  { key: "transport", label: "Transport" },
  { key: "otherCharges", label: "Other Charges" },
  { key: "ohProportion", label: "OH Proportion" },
  { key: "claimDeduction", label: "Claim Deduction" },
];

type FormState = Record<string, string>;

function toForm(cost: Record<string, unknown> | null): FormState {
  const f: FormState = {};
  for (const { key } of FIELDS) {
    const v = cost?.[key];
    f[key] = v == null || v === "" ? "" : String(v);
  }
  f.exchangeRate =
    cost?.exchangeRate == null ? "" : String(cost.exchangeRate);
  return f;
}

export function CostPanel({
  containerId,
  noOfBoxes,
  cost,
  canEdit,
  canFinalize,
  canUnlock,
}: {
  containerId: string;
  noOfBoxes: number | null;
  cost: Record<string, unknown> | null;
  canEdit: boolean;
  canFinalize: boolean;
  canUnlock: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(cost));
  const [saving, setSaving] = useState(false);

  const finalized = cost?.finalized === true;
  const editable = canEdit && !finalized;

  async function setFinalized(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/containers/${containerId}/costs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalized: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed");
        return;
      }
      toast.success(next ? "Cost sheet finalized & locked" : "Cost sheet unlocked");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  const inputs: CostInputs = useMemo(() => {
    const parse = (k: keyof CostInputs) => {
      const v = form[k as string];
      return v === "" ? null : Number(v);
    };
    return {
      beInvoiceValueInr: parse("beInvoiceValueInr"),
      customsDuty: parse("customsDuty"),
      clearingCharges: parse("clearingCharges"),
      linerCharges: parse("linerCharges"),
      detention: parse("detention"),
      chaCharges: parse("chaCharges"),
      transport: parse("transport"),
      otherCharges: parse("otherCharges"),
      ohProportion: parse("ohProportion"),
      claimDeduction: parse("claimDeduction"),
    };
  }, [form]);

  const computed = useMemo(
    () => computeCost(inputs, noOfBoxes),
    [inputs, noOfBoxes]
  );

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/containers/${containerId}/costs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save costs");
        return;
      }
      toast.success("Costs saved");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <h3 className="mb-4 font-heading text-base font-semibold">
            Landing Costs (INR)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key as string} className="space-y-1.5">
                <Label>{field.label}</Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  disabled={!editable || saving}
                  value={form[field.key as string]}
                  onChange={(e) =>
                    set(field.key as string, e.target.value)
                  }
                  className="font-financial"
                  placeholder="0.00"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Exchange Rate (USD→INR)</Label>
              <Input
                type="number"
                step="0.0001"
                disabled={!editable || saving}
                value={form.exchangeRate}
                onChange={(e) => set("exchangeRate", e.target.value)}
                className="font-financial"
                placeholder="0.0000"
              />
            </div>
          </div>

          {finalized && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-2.5 text-xs text-success">
              <Lock className="h-3.5 w-3.5" />
              Cost sheet finalized &amp; locked. Unlock to make changes.
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            {!finalized && canEdit && (
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save Costs
              </Button>
            )}
            {!finalized && canFinalize && cost && (
              <Button
                variant="outline"
                onClick={() => setFinalized(true)}
                disabled={saving}
              >
                <Lock className="h-4 w-4" /> Finalize
              </Button>
            )}
            {finalized && canUnlock && (
              <Button
                variant="outline"
                onClick={() => setFinalized(false)}
                disabled={saving}
              >
                <Unlock className="h-4 w-4" /> Unlock
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-t-4 border-t-primary">
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-heading text-base font-semibold">Computed</h3>
          <Computed label="Total Cost" value={formatINR(computed.totalCost)} />
          <Computed
            label="Rate / Box (Landing)"
            value={formatINR(computed.ratePerBoxLanding)}
          />
          <Computed
            label="Rate / Box (Final)"
            value={formatINR(computed.ratePerBox)}
            strong
          />
          <p className="pt-2 text-xs text-muted-foreground">
            {noOfBoxes ? `${noOfBoxes} boxes` : "Set No. of Boxes for per-box rates"}
            . Updates live; click Save to persist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Computed({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`font-financial ${strong ? "text-lg font-bold" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}
