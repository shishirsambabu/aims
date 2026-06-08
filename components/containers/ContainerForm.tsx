"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CONTAINER_STATUSES,
  CONTAINER_STATUS_LABELS,
  CUSTOMERS,
  PORTS,
} from "@/lib/constants";

interface SupplierOption {
  id: string;
  name: string;
}

interface FormValues {
  containerNo: string;
  blNo: string;
  supplierId: string;
  customer: string;
  port: string;
  item: string;
  variety: string;
  noOfBoxes: string;
  status: string;
  bookingDate: string;
  etd: string;
  eta: string;
  remarks: string;
}

export function ContainerForm({
  suppliers,
}: {
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { status: "Booked" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create container");
        return;
      }
      toast.success(`Container ${json.data.containerNo} created`);
      router.push(`/containers/${json.data.id}`);
      router.refresh();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Container Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Container No" error={errors.containerNo?.message}>
            <Input
              {...register("containerNo", { required: "Required" })}
              placeholder="MSCU1234567"
              className="font-financial"
            />
          </Field>
          <Field label="BL No" error={errors.blNo?.message}>
            <Input
              {...register("blNo", { required: "Required" })}
              placeholder="MEDUXX123456"
              className="font-financial"
            />
          </Field>

          <Field label="Supplier">
            <select
              {...register("supplierId")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Customer">
            <select
              {...register("customer")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select customer…</option>
              {CUSTOMERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Port">
            <select
              {...register("port")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select port…</option>
              {PORTS.map((p) => (
                <option key={p.code} value={p.name}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              {...register("status")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CONTAINER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONTAINER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Item">
            <Input {...register("item")} placeholder="Apples, Oranges…" />
          </Field>
          <Field label="Variety">
            <Input {...register("variety")} placeholder="Royal Gala…" />
          </Field>
          <Field label="No. of Boxes">
            <Input
              type="number"
              {...register("noOfBoxes")}
              placeholder="1100"
              className="font-financial"
            />
          </Field>
          <div />

          <Field label="Booking Date">
            <Input type="date" {...register("bookingDate")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ETD">
              <Input type="date" {...register("etd")} />
            </Field>
            <Field label="ETA">
              <Input type="date" {...register("eta")} />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Remarks">
              <Textarea {...register("remarks")} placeholder="Notes…" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Create Container
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
