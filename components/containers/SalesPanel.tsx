"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, TrendingDown, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatINR, marginColor } from "@/lib/utils";
import { computeProfit, type SaleInputs } from "@/lib/finance";

const FIELDS: { key: string; label: string; int?: boolean }[] = [
  { key: "soldQty", label: "Sold Qty", int: true },
  { key: "avgPrice", label: "Avg Price / Box" },
  { key: "saleValue", label: "Sale Value" },
  { key: "damageQty", label: "Damage Qty", int: true },
  { key: "damageValue", label: "Damage Value" },
];

type FormState = Record<string, string>;

function toForm(sale: Record<string, unknown> | null): FormState {
  const f: FormState = {};
  for (const { key } of FIELDS) {
    const v = sale?.[key];
    f[key] = v == null || v === "" ? "" : String(v);
  }
  return f;
}

export function SalesPanel({
  containerId,
  totalCost,
  sale,
  canEdit,
  canApprove,
}: {
  containerId: string;
  totalCost: number | null;
  sale: Record<string, unknown> | null;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(sale));
  const [saving, setSaving] = useState(false);

  const inputs: SaleInputs = useMemo(
    () => ({
      saleValue: form.saleValue === "" ? null : Number(form.saleValue),
      damageValue: form.damageValue === "" ? null : Number(form.damageValue),
      soldQty: form.soldQty === "" ? null : Number(form.soldQty),
    }),
    [form]
  );

  const result = useMemo(
    () => computeProfit(inputs, totalCost),
    [inputs, totalCost]
  );

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const reason = window.prompt("Sales update reason / review note (optional):") ?? "";
    setSaving(true);
    try {
      const res = await fetch(`/api/containers/${containerId}/sales`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save sales");
        return;
      }
      toast.success("Sales submitted for review");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  const profitUp = result.profit >= 0;
  const approvalStatus = String(sale?.approvalStatus ?? "Draft");

  async function review(action: "approve" | "reject") {
    const reason =
      action === "reject"
        ? window.prompt("Why are you rejecting these sales figures?")
        : window.prompt("Approval note (optional):") ?? "";
    if (action === "reject" && !reason?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/containers/${containerId}/sales`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to review sales");
        return;
      }
      toast.success(action === "approve" ? "Sales approved" : "Sales rejected");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-t-4 border-t-primary">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sale Value</p>
            <p className="font-financial mt-1 text-2xl font-bold">
              {formatINR(inputs.saleValue)}
            </p>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "border-t-4",
            profitUp ? "border-t-success" : "border-t-danger"
          )}
        >
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Profit / Container</p>
            <p
              className={cn(
                "font-financial mt-1 flex items-center gap-1 text-2xl font-bold",
                profitUp ? "text-success" : "text-danger"
              )}
            >
              {profitUp ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {formatINR(result.profit)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-warning">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Margin</p>
            <p
              className={cn(
                "font-financial mt-1 text-2xl font-bold",
                marginColor(result.marginPct)
              )}
            >
              {result.marginPct != null
                ? `${result.marginPct.toFixed(1)}%`
                : "—"}
            </p>
            <p className="font-financial mt-1 text-xs text-muted-foreground">
              Profit/Box {formatINR(result.profitPerBox)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 font-heading text-base font-semibold">
            Sales Figures
          </h3>
          {sale && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-alt/50 p-3 text-sm">
              <span>
                Review status:{" "}
                <strong className="font-semibold">{approvalStatus}</strong>
              </span>
              {canApprove && approvalStatus === "PendingApproval" && (
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => review("reject")}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => review("approve")}
                    disabled={saving}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                </span>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                <Input
                  type="number"
                  step={field.int ? "1" : "0.01"}
                  inputMode="decimal"
                  disabled={!canEdit || saving}
                  value={form[field.key]}
                  onChange={(e) => set(field.key, e.target.value)}
                  className="font-financial"
                  placeholder={field.int ? "0" : "0.00"}
                />
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Profit = Sale Value − Damage Value − Total Cost
            {totalCost != null && (
              <>
                {" "}
                (Total Cost{" "}
                <span className="font-financial">{formatINR(totalCost)}</span>)
              </>
            )}
            . Enter costs first for an accurate margin.
          </p>

          {canEdit && (
            <div className="mt-6 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save Sales
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
