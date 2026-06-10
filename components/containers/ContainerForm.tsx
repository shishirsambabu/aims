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
  STORAGE_BUCKET,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

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
  pol: string;
  origin: string;
  line: string;
  vessel: string;
  transhipment: string;
  item: string;
  variety: string;
  packageType: string;
  perPackageWeight: string;
  noOfBoxes: string;
  transitTime: string;
  status: string;
  bookingDate: string;
  etd: string;
  eta: string;
  ata: string;
  doUpto: string;
  emptyReturnDate: string;
  freeDays: string;
  lastFreeDate: string;
  shipperInvoiceNo: string;
  packingListNo: string;
  remarks: string;
}

export function ContainerForm({
  suppliers,
  orgId,
}: {
  suppliers: SupplierOption[];
  orgId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
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
      const containerId = json.data.id as string;

      // Upload the shipper invoice (if provided) as a Commercial Invoice doc.
      if (invoiceFile) {
        try {
          const supabase = createClient();
          const safe = invoiceFile.name.replace(/[^\w.\-]+/g, "_");
          // eslint-disable-next-line react-hooks/purity -- generated inside submit handler for a unique storage path
          const path = `${orgId}/${containerId}/CommercialInvoice/${Date.now()}_${safe}`;
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, invoiceFile, {
              upsert: true,
              contentType: invoiceFile.type,
            });
          if (upErr) {
            toast.warning(`Container created, but invoice upload failed: ${upErr.message}`);
          } else {
            await fetch("/api/documents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                containerId,
                type: "CommercialInvoice",
                docNo: values.shipperInvoiceNo,
                filePath: path,
                fileName: invoiceFile.name,
                fileSize: invoiceFile.size,
                status: "Uploaded",
              }),
            });
          }
        } catch {
          toast.warning("Container created, but the invoice upload failed.");
        }
      }

      toast.success(`Container ${json.data.containerNo} created`);
      router.push(`/containers/${containerId}`);
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
          <Field label="Port of Discharge (Arrival)">
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

          <Field label="Port of Loading (POL)">
            <Input {...register("pol")} placeholder="Hamburg, Cape Town…" />
          </Field>
          <Field label="Origin (Country)">
            <Input {...register("origin")} placeholder="Poland, South Africa…" />
          </Field>
          <Field label="Shipping Line">
            <Input {...register("line")} placeholder="HAPAG, CMA CGM…" />
          </Field>
          <Field label="Vessel & Voyage">
            <Input {...register("vessel")} placeholder="HMM COLOMBO 0148E" />
          </Field>
          <Field label="Transhipment">
            <Input {...register("transhipment")} placeholder="Colombo…" />
          </Field>
          <Field label="Package Type">
            <Input {...register("packageType")} placeholder="Carton, Box, Wooden…" />
          </Field>
          <Field label="Per-Package Weight (KG)">
            <Input
              type="number"
              step="0.001"
              {...register("perPackageWeight")}
              placeholder="13"
              className="font-financial"
            />
          </Field>
          <Field label="Transit Time (days)">
            <Input
              type="number"
              {...register("transitTime")}
              placeholder="34"
              className="font-financial"
            />
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="ATA (Actual Arrival)">
              <Input type="date" {...register("ata")} />
            </Field>
            <Field label="Empty Return">
              <Input type="date" {...register("emptyReturnDate")} />
            </Field>
          </div>

          <Field label="Free Days">
            <Input
              type="number"
              {...register("freeDays")}
              placeholder="e.g. 10"
              className="font-financial"
            />
          </Field>
          <Field label="Last Free Date (auto from ETA + Free Days)">
            <Input type="date" {...register("lastFreeDate")} />
          </Field>
          <Field label="DO Valid Upto">
            <Input type="date" {...register("doUpto")} />
          </Field>
          <div />

          <div className="sm:col-span-2">
            <Field label="Remarks">
              <Textarea {...register("remarks")} placeholder="Notes…" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipper Invoice</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Shipper Invoice No">
            <Input
              {...register("shipperInvoiceNo")}
              placeholder="2026-05-000012-EX"
              className="font-financial"
            />
          </Field>
          <Field label="Shipping / Packing List No">
            <Input
              {...register("packingListNo")}
              placeholder="PKG-…"
              className="font-financial"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Upload Shipper Invoice (PDF/JPG/PNG)">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-surface-alt file:px-3 file:py-1 file:text-sm"
              />
            </Field>
            {invoiceFile && (
              <p className="font-financial mt-1 text-xs text-muted-foreground">
                {invoiceFile.name}
              </p>
            )}
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
